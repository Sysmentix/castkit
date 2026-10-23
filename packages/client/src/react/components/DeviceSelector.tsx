import React from 'react';

export interface DeviceSelectorProps {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  selectedCamera: string;
  selectedMic: string;
  onSelectCamera: (deviceId: string) => void;
  onSelectMic: (deviceId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  cameras,
  microphones,
  selectedCamera,
  selectedMic,
  onSelectCamera,
  onSelectMic,
  className = '',
  style = {},
}) => {
  const selectStyle: React.CSSProperties = {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '4px',
    display: 'block',
    fontWeight: 500,
  };

  return (
    <div
      className={`stream-module-device-selector ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px',
        backgroundColor: '#111827',
        borderRadius: '12px',
        border: '1px solid #1f2937',
        ...style,
      }}
    >
      <div>
        <label style={labelStyle}>Camera</label>
        <select
          value={selectedCamera}
          onChange={(e) => onSelectCamera(e.target.value)}
          style={selectStyle}
        >
          {cameras.length === 0 && <option value="">No cameras detected</option>}
          {cameras.map((cam, idx) => (
            <option key={cam.deviceId || idx} value={cam.deviceId}>
              {cam.label || `Camera ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Microphone</label>
        <select
          value={selectedMic}
          onChange={(e) => onSelectMic(e.target.value)}
          style={selectStyle}
        >
          {microphones.length === 0 && <option value="">No microphones detected</option>}
          {microphones.map((mic, idx) => (
            <option key={mic.deviceId || idx} value={mic.deviceId}>
              {mic.label || `Microphone ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
