package __PACKAGE_NAME__

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val textView = TextView(this).apply {
            text = "Hello, __APP_NAME__!"
            textSize = 24f
            setPadding(16, 16, 16, 16)
        }
        setContentView(textView)
    }
}
