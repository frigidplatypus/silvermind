package ai.silvermind.app;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SbtaskPlugin")
public class SbtaskPlugin extends Plugin {

    private SbtaskProcess processManager;

    @Override
    public void load() {
        processManager = new SbtaskProcess(getContext());
        processManager.setOnStateChange(payload -> {
            notifyListeners("serviceStateChanged", payload.toJson());
        });
        processManager.start();
    }

    @PluginMethod
    public void start(PluginCall call) {
        processManager.start();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        processManager.stop();
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", processManager.isRunning());
        call.resolve(ret);
    }

    @PluginMethod
    public void restart(PluginCall call) {
        processManager.stop();
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            processManager.start();
            call.resolve();
        }, 300);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("state", processManager.isRunning() ? "running" : "unhealthy");
        call.resolve(ret);
    }
}
