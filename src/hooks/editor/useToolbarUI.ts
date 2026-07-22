// src/hooks/editor/useToolbarUI.ts
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * 기존 useNoteEditorFormatting 내부의
 * - 툴바 overflow 감지
 * - dropdown 위치 계산
 * - 외부 클릭 시 dropdown 닫기
 *
 * 기능을 그대로 분리한 훅입니다.
 */
export function useToolbarUI(
  toolbarRef: RefObject<HTMLDivElement | null>,
  toolbarLeftRef: RefObject<HTMLDivElement | null>,
  quizButtonRef: RefObject<HTMLButtonElement | null>
) {
  /** 기존 상태 그대로 */
  const [toolbarOverflow, setToolbarOverflow] = useState(false);

  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
  const [fontSizeDropdownPos, setFontSizeDropdownPos] = useState({
    top: 0,
    left: 0,
  });

  const [showLineHeightDropdown, setShowLineHeightDropdown] = useState(false);
  const [lineHeightDropdownPos, setLineHeightDropdownPos] = useState({
    top: 0,
    left: 0,
  });

  /**
   * 기존 로직 그대로 — 툴바와 Quiz 버튼의 위치로 overflow 여부 계산
   */
  useEffect(() => {
    const checkOverflow = () => {
      const toolbar = toolbarRef.current;
      const left = toolbarLeftRef.current;
      const quiz = quizButtonRef.current;
      if (!toolbar || !left || !quiz) return;

      const leftRect = left.getBoundingClientRect();
      const quizRect = quiz.getBoundingClientRect();

      const isOverflow = leftRect.right + 8 > quizRect.left;
      setToolbarOverflow(isOverflow);
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, []);

  /**
   * FontSize dropdown 위치 계산 (기존 handleFontSizeButtonClick 그대로)
   */
  const calcFontDropdownPosition = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const toolbar = toolbarRef.current;
    const btnRect = e.currentTarget.getBoundingClientRect();

    if (toolbar) {
      const toolbarRect = toolbar.getBoundingClientRect();
      setFontSizeDropdownPos({
        top: btnRect.bottom - toolbarRect.top + 4,
        left: btnRect.left - toolbarRect.left + btnRect.width / 2,
      });
    }

    setShowFontSizeDropdown((prev) => !prev);
    setShowLineHeightDropdown(false);
  };

  /**
   * LineHeight dropdown 위치 계산 (기존 handleLineHeightButtonClick 그대로)
   */
  const calcLineHeightDropdownPosition = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const toolbar = toolbarRef.current;
    const btnRect = e.currentTarget.getBoundingClientRect();

    if (toolbar) {
      const toolbarRect = toolbar.getBoundingClientRect();
      setLineHeightDropdownPos({
        top: btnRect.bottom - toolbarRect.top + 4,
        left: btnRect.left - toolbarRect.left + btnRect.width / 2,
      });
    }

    setShowLineHeightDropdown((prev) => !prev);
    setShowFontSizeDropdown(false);
  };

  /**
   * 기존 로직 그대로 — dropdown 외부 클릭 시 닫히도록 함
   */
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (
        target.closest('.toolbar-dropdown') ||
        target.closest('.toolbar-fontsize-button') ||
        target.closest('.toolbar-lineheight-trigger')
      ) {
        return;
      }

      setShowFontSizeDropdown(false);
      setShowLineHeightDropdown(false);
    };

    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  return {
    toolbarOverflow,

    showFontSizeDropdown,
    fontSizeDropdownPos,
    setShowFontSizeDropdown,
    calcFontDropdownPosition,

    showLineHeightDropdown,
    lineHeightDropdownPos,
    setShowLineHeightDropdown,
    calcLineHeightDropdownPosition,
  };
}
