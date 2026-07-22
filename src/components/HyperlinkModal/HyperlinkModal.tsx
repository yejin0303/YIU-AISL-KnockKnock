// src/components/HyperlinkModal/HyperlinkModal.tsx
import React, { useEffect, useState } from 'react';
import './HyperlinkModal.css';

type HyperlinkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultText?: string;
  defaultUrl?: string;
  onSubmit?: (text: string, url: string) => void;
};

const HyperlinkModal: React.FC<HyperlinkModalProps> = ({
  isOpen,
  onClose,
  defaultText = '',
  defaultUrl = '',
  onSubmit,
}) => {
  const [text, setText] = useState(defaultText);
  const [url, setUrl] = useState(defaultUrl);

  // 🔁 모달이 열릴 때마다 기본값으로 리셋
  useEffect(() => {
    if (isOpen) {
      setText(defaultText || '');
      setUrl(defaultUrl || '');
    }
  }, [isOpen, defaultText, defaultUrl]);

  if (!isOpen) return null;

  const overlayClick = () => onClose();
  const cardClick = (e: React.MouseEvent) => e.stopPropagation();

  const handleSubmit = () => {
    onSubmit?.(text, url);
    onClose();
  };

  return (
    <div className="hyperlink-overlay" onClick={overlayClick}>
      <div className="hyperlink-card" onClick={cardClick}>
        <h2 className="hyperlink-title">하이퍼링크 삽입</h2>

        <div className="hyperlink-row">
          <span className="hyperlink-label">표시할 텍스트 :</span>
          <input
            className="hyperlink-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="hyperlink-divider" />

        <div className="hyperlink-row">
          <span className="hyperlink-label">주소 :</span>
          <input
            className="hyperlink-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="hyperlink-divider" />

        <div className="hyperlink-submit-wrap">
          <button className="hyperlink-submit" onClick={handleSubmit}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
};

export default HyperlinkModal;
