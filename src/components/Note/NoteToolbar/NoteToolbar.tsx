// src/components/Note/NoteToolbar/NoteToolbar.tsx
import React from 'react';
import './NoteToolbar.css';

type InlineStyle = 'bold' | 'italic' | 'underline' | 'strike';

type DropdownConfig = {
  visible: boolean;
  top: number;
  left: number;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onSelect: (value: number) => void;
};

export interface NoteToolbarProps {
  currentFontSize: number;
  toolbarOverflow: boolean;

  fontSizeDropdown: DropdownConfig;
  lineHeightDropdown: DropdownConfig;

  activeInlineStyles: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
  };

  onInlineStyleClick: (
    style: InlineStyle,
    e: React.MouseEvent<HTMLButtonElement>
  ) => void;
  onCodeBlockClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onImageButtonClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCalloutClick: (e: React.MouseEvent<HTMLButtonElement>) => void;

  onTextAlignClick: (align: 'left' | 'right' | 'center' | 'justify') => void;
  onUnorderedListClick: () => void;
  onOrderedListClick: () => void;

  onQuizToggle: () => void;
  isQuizMode: boolean;
  quizButtonLabel: string;

  toolbarRef: React.RefObject<HTMLDivElement | null>;
  toolbarLeftRef: React.RefObject<HTMLDivElement | null>;
  quizButtonRef: React.RefObject<HTMLButtonElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  onImageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  onLinkButtonClick: (e: React.MouseEvent<HTMLButtonElement>) => void;

  saveCurrentSelection: () => void;

  insertImageAtSelection: (file: string) => void;
}

const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96];
const LINE_HEIGHTS = [1.0, 1.15, 1.25, 1.5, 2.0];

const clampNumber = (value: number, max: number) => {
  if (isNaN(value) || value <= 0) return null;
  return Math.min(value, max);
};

function iconButtonClass(active?: boolean) {
  return 'toolbar-icon-button' + (active ? ' toolbar-icon-button--active' : '');
}

export const NoteToolbar: React.FC<NoteToolbarProps> = (props) => {
  const {
    currentFontSize,
    fontSizeDropdown,
    lineHeightDropdown,
    activeInlineStyles,
    onInlineStyleClick,
    onCodeBlockClick,
    onImageButtonClick,
    onCalloutClick,
    onTextAlignClick,
    onUnorderedListClick,
    onOrderedListClick,
    onQuizToggle,
    isQuizMode,
    quizButtonLabel,
    toolbarRef,
    toolbarLeftRef,
    quizButtonRef,
    imageInputRef,
    onImageInputChange,
    onLinkButtonClick,
    saveCurrentSelection,
  } = props;

  return (
    <div className="note-toolbar" ref={toolbarRef}>
      <div className="note-toolbar-left" ref={toolbarLeftRef}>
        {/* 폰트 크기 */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-fontsize-button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              saveCurrentSelection();
              fontSizeDropdown.onToggle(e);
            }}
          >
            <span
              className="toolbar-fontsize-text"
              contentEditable
              suppressContentEditableWarning
              // 🔹 IME 조합 상태 추적
              onCompositionStart={(e) => {
                (e.currentTarget as any).__composing = true;
              }}
              onCompositionEnd={(e) => {
                (e.currentTarget as any).__composing = false;

                // 조합 끝난 직후 정제
                const el = e.currentTarget;
                const cleaned = el.innerText.replace(/[^0-9]/g, '');
                el.innerText = cleaned;

                // 커서 맨 뒤로
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(el);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
              }}
              // 🔥 모든 입력 후 강제 정제 (가장 중요)
              onInput={(e) => {
                const el = e.currentTarget;

                // IME 조합 중이면 건드리지 않음
                if ((el as any).__composing) return;

                const cleaned = el.innerText.replace(/[^0-9]/g, '');
                if (el.innerText !== cleaned) {
                  el.innerText = cleaned;

                  // 커서 유지
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(el);
                  range.collapse(false);
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                }
              }}
              onBeforeInput={(e) => {
                // 숫자만 허용
                if (!/^[0-9]$/.test(e.data ?? '')) {
                  e.preventDefault();
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                saveCurrentSelection();
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                // Enter → 확정
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLSpanElement).blur();
                  return;
                }

                // 허용할 키
                const allowedKeys = [
                  'Backspace',
                  'Delete',
                  'ArrowLeft',
                  'ArrowRight',
                  'Tab',
                ];

                // 숫자면 통과
                if (/^[0-9]$/.test(e.key)) return;

                // 허용 키면 통과
                if (allowedKeys.includes(e.key)) return;

                // 그 외 전부 차단
                e.preventDefault();
              }}
              onBlur={(e) => {
                const raw = (e.target as HTMLSpanElement).innerText.replace(
                  /[^0-9]/g,
                  ''
                );
                const value = clampNumber(Number(raw), 300);

                if (value !== null) {
                  fontSizeDropdown.onSelect(value);
                  (e.target as HTMLSpanElement).innerText = String(value);
                }
              }}
            >
              {currentFontSize}
            </span>
            <span className="toolbar-fontsize-unit">p</span>
          </button>

          {fontSizeDropdown.visible && (
            <div className="toolbar-dropdown toolbar-dropdown--fontsize">
              {FONT_SIZES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  className={
                    'toolbar-dropdown-item' +
                    (pt === currentFontSize
                      ? ' toolbar-dropdown-item--active'
                      : '')
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveCurrentSelection();
                    fontSizeDropdown.onSelect(pt);
                  }}
                >
                  {pt}p
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 서식 (B I U S) */}
        <div className="toolbar-group">
          {/* BOLD */}
          <button
            type="button"
            className={
              iconButtonClass(activeInlineStyles.bold) + ' toolbar-icon-bold'
            }
            onMouseDown={(e) => onInlineStyleClick('bold', e)}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/bold-icon.png" alt="굵게" />
            </span>
          </button>

          {/* ITALIC */}
          <button
            type="button"
            className={
              iconButtonClass(activeInlineStyles.italic) +
              ' toolbar-icon-italic'
            }
            onMouseDown={(e) => onInlineStyleClick('italic', e)}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/italic-icon.png" alt="기울임" />
            </span>
          </button>

          {/* UNDERLINE */}
          <button
            type="button"
            className={
              iconButtonClass(activeInlineStyles.underline) +
              ' toolbar-icon-underline'
            }
            onMouseDown={(e) => onInlineStyleClick('underline', e)}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/underline-icon.png" alt="밑줄" />
            </span>
          </button>

          {/* STRIKE */}
          <button
            type="button"
            className={
              iconButtonClass(activeInlineStyles.strike) +
              ' toolbar-icon-strike'
            }
            onMouseDown={(e) => onInlineStyleClick('strike', e)}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/strike-icon.png" alt="취소선" />
            </span>
          </button>
        </div>

        {/* 코드 블록 / 콜아웃 / 이미지 / 링크 */}
        <div className="toolbar-group">
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-code'}
            onMouseDown={onCodeBlockClick}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/code-icon.png" alt="코드 블록" />
            </span>
          </button>
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-callout'}
            onMouseDown={onCalloutClick}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/callout-icon.png" alt="콜아웃" />
            </span>
          </button>
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-image-add'}
            onClick={onImageButtonClick}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/image-add-icon.png" alt="이미지 추가" />
            </span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png, image/jpeg"
            style={{ display: 'none' }}
            onChange={onImageInputChange}
          />
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-link'}
            onMouseDown={(e) => {
              e.preventDefault();
              onLinkButtonClick(e);
            }}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/link-icon.png" alt="링크" />
            </span>
          </button>
        </div>

        {/* 정렬 */}
        <div className="toolbar-group">
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-align-left'}
            onMouseDown={(e) => {
              e.preventDefault();
              onTextAlignClick('left');
            }}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/align-left-icon.png" alt="왼쪽 정렬" />
            </span>
          </button>
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-align-center'}
            onMouseDown={(e) => {
              e.preventDefault();
              onTextAlignClick('center');
            }}
          >
            <span className="toolbar-icon-inner">
              <img
                src="/assets/icons/align-center-icon.png"
                alt="가운데 정렬"
              />
            </span>
          </button>
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-align-right'}
            onMouseDown={(e) => {
              e.preventDefault();
              onTextAlignClick('right');
            }}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/align-right-icon.png" alt="오른쪽 정렬" />
            </span>
          </button>
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-align-justify'}
            onMouseDown={(e) => {
              e.preventDefault();
              onTextAlignClick('justify');
            }}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/align-justify-icon.png" alt="양쪽 정렬" />
            </span>
          </button>
        </div>

        {/* 목록 */}
        <div className="toolbar-group">
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-unordered-list'}
            onMouseDown={(e) => {
              e.preventDefault();
              onUnorderedListClick();
            }}
          >
            <span className="toolbar-icon-inner">
              <img
                src="/assets/icons/unordered-list-icon.png"
                alt="불릿 목록"
              />
            </span>
          </button>
          <button
            type="button"
            className={iconButtonClass() + ' toolbar-icon-ordered-list'}
            onMouseDown={(e) => {
              e.preventDefault();
              onOrderedListClick();
            }}
          >
            <span className="toolbar-icon-inner">
              <img src="/assets/icons/ordered-list-icon.png" alt="번호 목록" />
            </span>
          </button>
        </div>

        {/* 줄 간격 */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-lineheight-button toolbar-lineheight-trigger"
            onMouseDown={(e) => {
              saveCurrentSelection();
              lineHeightDropdown.onToggle(e);
            }}
          >
            <img src="/assets/icons/line-height-icon.png" alt="줄 간격" />
          </button>

          {lineHeightDropdown.visible && (
            <div className="toolbar-dropdown">
              {/* ============================
                  🔥 ① 줄간격 직접 입력 Input
                ============================ */}
              <div
                className="toolbar-dropdown-input-wrapper"
                onMouseDown={(e) => {
                  // 드롭다운 닫힘 방지 + input 포커스 방해하지 않기
                  e.stopPropagation();
                }}
              >
                <input
                  type="text"
                  className="toolbar-lineheight-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="직접 입력"
                  onChange={(e) => {
                    // 숫자만 유지
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();

                      const value = clampNumber(
                        Number(e.currentTarget.value),
                        30
                      );
                      if (value !== null) {
                        saveCurrentSelection();
                        lineHeightDropdown.onSelect(value);
                        e.currentTarget.value = String(value);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = clampNumber(
                      Number(e.currentTarget.value),
                      30
                    );
                    if (value !== null) {
                      saveCurrentSelection();
                      lineHeightDropdown.onSelect(value);
                      e.currentTarget.value = String(value);
                    }
                  }}
                />
              </div>

              {/* ============================
        ② 기존 줄간격 프리셋 옵션
       ============================ */}
              {LINE_HEIGHTS.map((lh) => (
                <button
                  key={lh}
                  type="button"
                  className="toolbar-dropdown-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    saveCurrentSelection();
                    lineHeightDropdown.onSelect(lh);
                  }}
                >
                  {lh.toFixed(2).replace(/\.00$/, '')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽 Quiz 버튼 */}
      <div className="note-toolbar-right">
        <button
          type="button"
          ref={quizButtonRef}
          className={
            'note-toolbar-quiz-button' +
            (isQuizMode ? ' note-toolbar-quiz-button--active' : '')
          }
          onClick={onQuizToggle}
        >
          {quizButtonLabel}
        </button>
      </div>
    </div>
  );
};
