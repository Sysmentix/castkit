export interface MediaDeviceInfoList {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

export class DeviceManager {
  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  public static async requestPermissions(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new Error('MediaDevices API not supported in this environment');
    }
    return navigator.mediaDevices.getUserMedia({ video, audio });
  }

  public static async getDevices(): Promise<MediaDeviceInfoList> {
    if (!this.isSupported()) {
      return { cameras: [], microphones: [], speakers: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        cameras: devices.filter((d) => d.kind === 'videoinput'),
        microphones: devices.filter((d) => d.kind === 'audioinput'),
        speakers: devices.filter((d) => d.kind === 'audiooutput'),
      };
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
      return { cameras: [], microphones: [], speakers: [] };
    }
  }

  public static onDeviceChange(callback: () => void): () => void {
    if (!this.isSupported()) return () => {};
    navigator.mediaDevices.addEventListener('devicechange', callback);
    return () => navigator.mediaDevices.removeEventListener('devicechange', callback);
  }
}
