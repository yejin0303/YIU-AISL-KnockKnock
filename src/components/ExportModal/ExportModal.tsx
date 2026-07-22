// src\components\ExportModal\ExportModal.tsx
import React, { useState, useEffect } from 'react';
import './ExportModal.css';

type ExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onChangeFileName?: (v: string) => void;

  onDownload?: (params: { fileName: string; format: string }) => void;
};

const FORMAT_OPTIONS = ['JPEG', 'PDF', 'PNG'];

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  fileName,
  onChangeFileName,
  onDownload,
}) => {
  const [localFileName, setLocalFileName] = useState(fileName);

  useEffect(() => {
    setLocalFileName(fileName);
  }, [fileName]);

  const [format, setFormat] = useState('PDF');

  if (!isOpen) return null;

  const handleOverlayClick = () => onClose();
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) =>
    e.stopPropagation();

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFileName(e.target.value);
    onChangeFileName?.(e.target.value);
  };

  const handleDownloadClick = () => {
    onDownload?.({
      fileName: localFileName,
      format,
    });
  };

  return (
    <div className="export-modal-overlay" onClick={handleOverlayClick}>
      <div className="export-modal-card" onClick={handleCardClick}>
        <div className="export-modal-header">
          <h2 className="export-modal-title">Export</h2>
        </div>

        {/* 다음으로 내보내기 */}
        <div className="export-modal-row">
          <span className="export-modal-label">다음으로 내보내기 :</span>
          <input
            className="export-modal-input"
            value={localFileName}
            onChange={handleFileNameChange}
          />
        </div>

        {/* 포멧 */}
        <div className="export-modal-row">
          <span className="export-modal-label">포멧 :</span>

          <select
            className="export-modal-select"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 다운로드 버튼 */}
        <div className="export-modal-actions">
          <button
            type="button"
            className="export-modal-download-btn"
            onClick={handleDownloadClick}
          >
            다운로드
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
