package ai.silvermind.app;

import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "Silvermind";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Log.i(TAG, "onCreate — starting Silvermind");
        registerPlugin(SbtaskPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            Toast.makeText(this, "Silvermind starting...", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e(TAG, "Toast failed", e);
        }
        Log.i(TAG, "onCreate — complete");
    }
}
