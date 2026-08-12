// TypeScript's bundled DOM lib includes the File System Access API's
// picker methods (showDirectoryPicker, etc.) but not yet the permissions
// extension (queryPermission/requestPermission) — augment via declaration
// merging rather than redeclaring the whole FileSystemHandle interface.
export {};

declare global {
  type FileSystemPermissionMode = "read" | "readwrite";

  interface FileSystemHandlePermissionDescriptor {
    mode?: FileSystemPermissionMode;
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface DirectoryPickerOptions {
    mode?: FileSystemPermissionMode;
  }

  interface Window {
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }
}
