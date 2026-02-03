package watch.shiru;

public class NativeBridge {
  private final android.app.Activity activity;

  public NativeBridge(android.app.Activity activity) {
    this.activity = activity;
  }

  @android.webkit.JavascriptInterface
  public void requestAllFilesAccess() {
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
      if (!android.os.Environment.isExternalStorageManager()) {
        android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
        intent.setData(android.net.Uri.parse("package:" + activity.getPackageName()));
        activity.startActivity(intent);
      }
    }
  }

  @android.webkit.JavascriptInterface
  public boolean hasAllFilesAccess() {
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
      return android.os.Environment.isExternalStorageManager();
    }
    return true;
  }
}