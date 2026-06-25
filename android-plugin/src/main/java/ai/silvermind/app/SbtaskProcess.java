package ai.silvermind.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SbtaskProcess {

    private static final String TAG = "SbtaskProcess";
    private static final int HEALTH_CHECK_INTERVAL_MS = 2000;
    private static final int HEALTH_CHECK_TIMEOUT_MS = 2000;
    private static final int MAX_RESTARTS = 3;
    private static final int RESTART_DELAY_MS = 500;
    private static final int HEALTH_PORT = 7433;

    private final Context context;
    private volatile Process process;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable healthCheckRunnable;
    private int restartCount = 0;
    private volatile boolean stopping = false;
    private OnStateChangeListener onStateChange;

    public interface OnStateChangeListener {
        void onStateChange(ServiceHealthPayload payload);
    }

    public static class ServiceHealthPayload {
        public final String state;
        public final Double lastOkAt;
        public final int restartCount;
        public final String lastError;

        public ServiceHealthPayload(String state, Double lastOkAt, int restartCount, String lastError) {
            this.state = state;
            this.lastOkAt = lastOkAt;
            this.restartCount = restartCount;
            this.lastError = lastError;
        }

        public com.getcapacitor.JSObject toJson() {
            com.getcapacitor.JSObject obj = new com.getcapacitor.JSObject();
            obj.put("state", state);
            obj.put("restartCount", restartCount);
            if (lastOkAt != null) obj.put("lastOkAt", lastOkAt);
            if (lastError != null) obj.put("lastError", lastError);
            return obj;
        }
    }

    public SbtaskProcess(Context context) {
        this.context = context;
    }

    public void setOnStateChange(OnStateChangeListener listener) {
        this.onStateChange = listener;
    }

    public void start() {
        restartCount = 0;
        stopping = false;
        emitStateChange("starting", null);
        // Run binary copy on background thread — reading 9MB from assets
        // on the main thread blocks the UI and causes a black screen.
        new Thread(() -> {
            String binary = setupBinary();
            if (binary == null) {
                new Handler(Looper.getMainLooper()).post(() ->
                    emitStateChange("failed", "sbtask binary not found in assets"));
                return;
            }
            launchProcess(binary);
        }).start();
    }

    public void stop() {
        stopping = true;
        stopHealthChecks();
        if (process != null) {
            process.destroy();
            process = null;
        }
    }

    public boolean isRunning() {
        return process != null && process.isAlive();
    }

    // --- private ---

    private String setupBinary() {
        try {
            File destDir = new File(context.getFilesDir(), "sbtask");
            destDir.mkdirs();
            File destFile = new File(destDir, "sbtask");

            if (!destFile.exists()) {
                try (InputStream in = context.getAssets().open("sbtask");
                     FileOutputStream out = new FileOutputStream(destFile)) {
                    byte[] buf = new byte[8192];
                    int len;
                    while ((len = in.read(buf)) != -1) {
                        out.write(buf, 0, len);
                    }
                }
                destFile.setExecutable(true);
            }

            return destFile.getAbsolutePath();
        } catch (Exception e) {
            Log.e(TAG, "Failed to setup binary", e);
            return null;
        }
    }

    private void launchProcess(String binary) {
        try {
            ProcessBuilder pb = new ProcessBuilder(binary, "serve");
            pb.environment().put("HOME", context.getFilesDir().getAbsolutePath());
            pb.redirectErrorStream(true);

            process = pb.start();
            emitStateChange("running", null);
            startHealthChecks();

            new Thread(() -> {
                try {
                    int exitCode = process.waitFor();
                    new Handler(Looper.getMainLooper()).post(() -> {
                        if (stopping) return;
                        process = null;
                        String reason = "exit";
                        if (restartCount < MAX_RESTARTS) {
                            restartCount++;
                            emitStateChange("restarting",
                                "sbtask " + reason + " (attempt " + restartCount + "/" + MAX_RESTARTS + ")");
                            handler.postDelayed(() -> launchProcess(setupBinary()), RESTART_DELAY_MS);
                        } else {
                            stopHealthChecks();
                            emitStateChange("failed",
                                "sbtask " + reason + " after " + MAX_RESTARTS + " restarts");
                        }
                    });
                } catch (InterruptedException e) {
                    // process terminated
                }
            }).start();

        } catch (Exception e) {
            emitStateChange("failed", "Failed to start sbtask: " + e.getMessage());
        }
    }

    private void startHealthChecks() {
        stopHealthChecks();
        healthCheckRunnable = new Runnable() {
            @Override
            public void run() {
                if (stopping) return;
                checkHealth();
                if (!stopping) {
                    handler.postDelayed(this, HEALTH_CHECK_INTERVAL_MS);
                }
            }
        };
        handler.postDelayed(healthCheckRunnable, HEALTH_CHECK_INTERVAL_MS);
    }

    private void stopHealthChecks() {
        if (healthCheckRunnable != null) {
            handler.removeCallbacks(healthCheckRunnable);
            healthCheckRunnable = null;
        }
    }

    private void checkHealth() {
        new Thread(() -> {
            try {
                URL url = new URL("http://127.0.0.1:" + HEALTH_PORT + "/health");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(HEALTH_CHECK_TIMEOUT_MS);
                conn.setReadTimeout(HEALTH_CHECK_TIMEOUT_MS);
                int responseCode = conn.getResponseCode();
                conn.disconnect();

                if (responseCode != 200) {
                    if (process == null || !process.isAlive()) {
                        handler.post(() ->
                            emitStateChange("unhealthy", "Health check failed: status " + responseCode));
                    }
                }
            } catch (Exception e) {
                if (process == null || !process.isAlive()) {
                    handler.post(() ->
                        emitStateChange("unhealthy", "Health check failed: " + e.getMessage()));
                }
            }
        }).start();
    }

    private void emitStateChange(String state, String error) {
        if (onStateChange == null) return;
        Double lastOkAt = state.equals("running") ? (double) System.currentTimeMillis() : null;
        ServiceHealthPayload payload = new ServiceHealthPayload(state, lastOkAt, restartCount, error);
        new Handler(Looper.getMainLooper()).post(() -> onStateChange.onStateChange(payload));
    }
}
