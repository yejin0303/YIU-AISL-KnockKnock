// src/hooks/editor/useBlockFormatting.ts
import type { RefObject } from 'react';

/**
 * 블록 레벨 서식 기능(목록, 정렬, 코드블록, 콜아웃) 훅입니다.
 */

export function useBlockFormatting(
  editorRef: RefObject<HTMLDivElement | null>,
  syncContent: () => void
) {
  /**
   * findBlockElement 유지
   */
  const findBlockElement = (
    editor: HTMLElement | null,
    range: Range
  ): HTMLElement | null => {
    if (!editor) return null;

    let node: HTMLElement | null =
      range.startContainer.nodeType === 1
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;

    while (node && node !== editor) {
      const display = window.getComputedStyle(node).display;

      if (
        display === 'block' ||
        node.tagName === 'P' ||
        node.tagName === 'DIV' ||
        node.tagName === 'LI'
      ) {
        return node;
      }

      node = node.parentElement;
    }
    return null;
  };

  // 현재 selection이 특정 wrapper 내부인지 검사
  const isInsideBlock = (classNames: string[]) => {
    const editor = editorRef.current;
    if (!editor) return false;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    let node: HTMLElement | null =
      sel.getRangeAt(0).startContainer.nodeType === Node.TEXT_NODE
        ? sel.getRangeAt(0).startContainer.parentElement
        : (sel.getRangeAt(0).startContainer as HTMLElement);

    while (node && node !== editor) {
      for (const cls of classNames) {
        if (node.classList?.contains(cls)) return true;
      }
      node = node.parentElement;
    }

    return false;
  };

  // ⭐ 어떤 wrapper 블록(코드블럭 또는 콜아웃)이든
  // 문단과 분리되도록 위·아래에 <p><br></p> 삽입하는 헬퍼
  const insertBlockWithSpacers = (
    wrapper: HTMLElement,
    editor: HTMLElement,
    range: Range
  ) => {
    // 1) 현재 블록을 찾는다
    let block = range.startContainer as HTMLElement;
    while (
      block &&
      block !== editor &&
      block.tagName !== 'P' &&
      block.tagName !== 'DIV' &&
      block.tagName !== 'LI'
    ) {
      block = block.parentElement as HTMLElement;
    }

    const topSpacer = document.createElement('p');
    topSpacer.innerHTML = '<br>';

    const bottomSpacer = document.createElement('p');
    bottomSpacer.innerHTML = '<br>';

    if (block && block !== editor) {
      block.insertAdjacentElement('afterend', bottomSpacer);
      block.insertAdjacentElement('afterend', wrapper);
      block.insertAdjacentElement('afterend', topSpacer);
    } else {
      editor.appendChild(topSpacer);
      editor.appendChild(wrapper);
      editor.appendChild(bottomSpacer);
    }

    return wrapper;
  };

  const splitBlockBySelection = (
    editor: HTMLElement,
    range: Range,
    wrapper: HTMLElement
  ) => {
    const block = findBlockElement(editor, range);
    if (!block) {
      range.insertNode(wrapper);
      return wrapper;
    }

    const parent = block.parentNode;
    if (!parent) return wrapper;

    // 1) block을 기준으로 beforeRange / selectedRange / afterRange 추출
    const beforeRange = document.createRange();
    beforeRange.setStartBefore(block);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const beforeFragment = beforeRange.extractContents();

    const middleFragment = range.extractContents();

    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEndAfter(block);
    const afterFragment = afterRange.extractContents();

    // 2) wrapper 내부에 middleFragment 삽입
    const inner = wrapper.querySelector(
      '.editor-code-block-inner, .editor-callout-content'
    );
    if (inner) inner.appendChild(middleFragment);

    // 3) block 대신 3개 조각(before → wrapper → after)을 정확한 위치에 삽입
    // block 바로 다음 형제 노드를 anchor로 확보
    const anchor = block.nextSibling;

    // before
    if (beforeFragment.childNodes.length > 0) {
      const p = document.createElement('p');
      p.appendChild(beforeFragment);
      parent.insertBefore(p, block);
    }

    // wrapper
    parent.insertBefore(wrapper, block);

    // after
    if (afterFragment.childNodes.length > 0) {
      const p = document.createElement('p');
      p.appendChild(afterFragment);
      parent.insertBefore(p, block);
    }

    // 4) 마지막에 block 제거
    parent.removeChild(block);

    return wrapper;
  };

  /**
   * applyTextAlignToCurrentParagraph
   */
  const applyTextAlignToCurrentParagraph = (
    align: 'left' | 'right' | 'center' | 'justify'
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const block = findBlockElement(editor, range);
    if (block) {
      block.style.textAlign = align;
      syncContent();
    }
  };

  /**
   * handleTextAlignClick
   */
  const handleTextAlignClick = (
    align: 'left' | 'right' | 'center' | 'justify'
  ) => {
    applyTextAlignToCurrentParagraph(align);
  };

  /**
   * applyListToCurrentParagraph
   */
  const applyListToCurrentParagraph = (listType: 'ul' | 'ol') => {
    if (!isSelectionInsideEditor()) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const block = findBlockElement(editor, range);

    /**
     * block이 없을 때 새 목록 append
     */
    if (!block || block === editor) {
      const list = document.createElement(listType);
      list.className =
        listType === 'ul'
          ? 'editor-list editor-list--unordered'
          : 'editor-list editor-list--ordered';

      const li = document.createElement('li');
      li.innerHTML = '';
      list.appendChild(li);

      editor.appendChild(list);

      syncContent();

      const newSel = window.getSelection();
      if (newSel) {
        newSel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(li);
        newRange.collapse(true);
        newSel.addRange(newRange);
      }
      return;
    }

    /**
     * 이미 LI 안에 있을 때 목록 타입만 변경
     */
    if (
      block.tagName === 'LI' &&
      block.parentElement &&
      (block.parentElement.tagName === 'UL' ||
        block.parentElement.tagName === 'OL')
    ) {
      const currentList = block.parentElement;

      if (
        (listType === 'ul' && currentList.tagName === 'UL') ||
        (listType === 'ol' && currentList.tagName === 'OL')
      ) {
        return;
      }

      const newList = document.createElement(listType);
      newList.className =
        listType === 'ul'
          ? 'editor-list editor-list--unordered'
          : 'editor-list editor-list--ordered';

      while (currentList.firstChild) {
        newList.appendChild(currentList.firstChild);
      }
      currentList.replaceWith(newList);

      syncContent();

      const newSel = window.getSelection();
      if (newSel) {
        newSel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(block);
        newRange.collapse(false);
        newSel.addRange(newRange);
      }
      return;
    }

    /**
     * 일반 문단을 목록으로 감싸기
     */
    const list = document.createElement(listType);
    list.className =
      listType === 'ul'
        ? 'editor-list editor-list--unordered'
        : 'editor-list editor-list--ordered';

    const li = document.createElement('li');
    li.innerHTML = block.innerHTML;
    list.appendChild(li);

    block.replaceWith(list);

    syncContent();

    const newSel = window.getSelection();
    if (newSel) {
      newSel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(li);
      newRange.collapse(false);
      newSel.addRange(newRange);
    }
  };

  const handleUnorderedListClick = () => {
    applyListToCurrentParagraph('ul');
  };

  const handleOrderedListClick = () => {
    applyListToCurrentParagraph('ol');
  };

  const notifySelectText = () => {
    alert('텍스트를 선택하세요.');
  };

  const applyCodeBlockToSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // 🚫 선택 없음 → 안내 후 중단
    if (sel.isCollapsed) {
      notifySelectText();
      return;
    }

    const range = sel.getRangeAt(0);

    // 선택된 텍스트 감싸기
    // 선택 wrap (sel.isCollapsed가 false일 때)
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-code-block';

    const code = document.createElement('code');
    code.className = 'editor-code-block-inner';

    const contents = range.extractContents();
    code.appendChild(contents);
    wrapper.appendChild(code);

    // ⭐ wrap도 반드시 문단과 분리해서 들어가야 함
    const resultNode = splitBlockBySelection(editor, range, wrapper);

    if (!resultNode) return;

    const newRange = document.createRange();
    newRange.setStartAfter(resultNode);
    newRange.collapse(true);

    sel.removeAllRanges();
    sel.addRange(newRange);

    syncContent();
  };

  const handleCodeBlockClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();

    // 🚫 코드블럭 내부에서 코드블럭/콜아웃 생성 금지
    if (isInsideBlock(['editor-code-block-inner', 'editor-callout-content'])) {
      return; // 아무것도 하지 않음
    }

    applyCodeBlockToSelection();
  };

  const handleCalloutClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // 🚫 코드블럭 또는 콜아웃 내부에서 콜아웃/코드블럭 생성 금지
    if (isInsideBlock(['editor-code-block-inner', 'editor-callout-content'])) {
      return; // 아무것도 하지 않음
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // 🚫 선택 없음 → 안내 후 중단
    if (sel.isCollapsed) {
      notifySelectText();
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const range = sel.getRangeAt(0);

    const wrapper = document.createElement('div');
    wrapper.className = 'editor-callout';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'editor-callout-icon';
    iconSpan.textContent = '💡';

    const contentSpan = document.createElement('span');
    contentSpan.className = 'editor-callout-content';

    const contents = range.extractContents();
    contentSpan.appendChild(contents);

    wrapper.appendChild(iconSpan);
    wrapper.appendChild(contentSpan);

    // ⭐ wrap도 문단 분리
    const resultNode = splitBlockBySelection(editor, range, wrapper);

    const newRange = document.createRange();
    newRange.setStartAfter(resultNode);
    newRange.collapse(true);

    sel.removeAllRanges();
    sel.addRange(newRange);

    syncContent();
  };

  /**
   * applyLineHeightToCurrentParagraph
   * 문단(block)에 줄간격 적용
   */
  const applyLineHeightToCurrentParagraph = (lh: number) => {
    if (!isSelectionInsideEditor()) {
      // 선택이 에디터 내부가 아니면(즉, 인풋에 포커스된 상태면) 적용하지 않음
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const block = findBlockElement(editor, range);

    if (block) {
      block.style.lineHeight = String(lh);
      syncContent();
    }
  };

  const handleLineHeightClick = (lh: number) => {
    applyLineHeightToCurrentParagraph(lh);
  };

  const isSelectionInsideEditor = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return false;

    const node = sel.getRangeAt(0).startContainer;
    return editor.contains(node);
  };

  return {
    findBlockElement,

    applyTextAlignToCurrentParagraph,
    handleTextAlignClick,

    applyLineHeightToCurrentParagraph,
    handleLineHeightClick,

    applyListToCurrentParagraph,
    handleUnorderedListClick,
    handleOrderedListClick,

    applyCodeBlockToSelection,
    handleCodeBlockClick,

    handleCalloutClick,
  };
}
