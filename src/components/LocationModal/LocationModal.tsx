import React, { useState } from 'react';
import './LocationModal.css';

import folderIcon from '../../../public/assets/icons/forder-icon.png';
import moreIcon from '../../../public/assets/icons/more-icon.png';

type LocationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  folderName: string;
  onChangeFileName?: (v: string) => void; // 부모에게 전달하고 싶으면 사용
};

const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  fileName,
  folderName,
  onChangeFileName,
}) => {
  const [localFileName, setLocalFileName] = useState(fileName);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    onClose();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFileName(e.target.value);
    onChangeFileName?.(e.target.value);
  };

  return (
    <div className="location-modal-overlay" onClick={handleOverlayClick}>
      <div className="location-modal-card" onClick={handleCardClick}>
        <div className="location-modal-header">
          <h2 className="location-modal-title">Location</h2>
        </div>

        <div className="location-modal-divider" />

        {/* 파일 이름 row */}
        <div className="location-modal-row">
          <span className="location-modal-label">파일 이름:</span>

          <input
            className="location-modal-input"
            value={localFileName}
            onChange={handleInputChange}
          />
        </div>

        <div className="location-modal-divider" />

        <div className="location-modal-row">
          <span className="location-modal-label">위치 :</span>

          <button type="button" className="location-modal-folder-btn">
            <img src={folderIcon} className="location-modal-folder-icon" />
            <span className="location-modal-folder-name">{folderName}</span>
            <img src={moreIcon} className="location-modal-more-icon" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationModal;
