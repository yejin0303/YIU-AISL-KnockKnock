import React from 'react';
import './DeleteAccountModal.css';

type DeleteAccountModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  cancelText?: string;
  okText?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  title = '회원을 탈퇴하시겠습니까?',
  description = '회원님의 소중한 모든 정보가 영구 삭제됩니다.',
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

export default DeleteAccountModal;
