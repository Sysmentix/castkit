import { useState, useEffect, useCallback } from 'react';
import { DeviceManager, MediaDeviceInfoList } from '../../devices.js';

export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfoList>({
    cameras: [],
    microphones: [],
    speakers: [],
  });
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const refreshDevices = useCallback(async () => {
    if (!DeviceManager.isSupported()) {
      setIsSupported(false);
      return;
    }

    try {
      const devList = await DeviceManager.getDevices();
      setDevices(devList);

      if (devList.cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(devList.cameras[0].deviceId);
      }
      if (devList.microphones.length > 0 && !selectedMic) {
        setSelectedMic(devList.microphones[0].deviceId);
      }
      if (devList.speakers.length > 0 && !selectedSpeaker) {
        setSelectedSpeaker(devList.speakers[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to refresh media devices:', err);
    }
  }, [selectedCamera, selectedMic, selectedSpeaker]);

  useEffect(() => {
    refreshDevices();
    const cleanup = DeviceManager.onDeviceChange(() => {
      refreshDevices();
    });
    return cleanup;
  }, [refreshDevices]);

  return {
    cameras: devices.cameras,
    microphones: devices.microphones,
    speakers: devices.speakers,
    selectedCamera,
    selectedMic,
    selectedSpeaker,
    setSelectedCamera,
    setSelectedMic,
    setSelectedSpeaker,
    refreshDevices,
    isSupported,
  };
}
