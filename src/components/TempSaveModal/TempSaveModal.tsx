import React from 'react';
import './TempSaveModal.css';

type TempSaveModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  cancelText?: string;
  okText?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const TempSaveModal: React.FC<TempSaveModalProps> = ({
  isOpen,
  title = '진행 중이던 암기 파일이 있습니다',
  description = '이어서 하시겠습니까?',
  cancelText = 'cancel',
  okText = 'OK',
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => onCancel();
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) =>
    e.stopPropagation();

  return (
    <div className="confirm-overlay" onClick={handleOverlayClick}>
      <div className="confirm-card" onClick={handleCardClick}>
        <h2 className="confirm-title">{title}</h2>
        <p className="confirm-description">{description}</p>

        <div className="confirm-button-row">
          <button
            type="button"
            className="confirm-button cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>

          <span className="confirm-divider-vertical" />

          <button
            type="button"
            className="confirm-button ok"
            onClick={onConfirm}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TempSaveModal;
