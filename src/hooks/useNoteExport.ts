//src\hooks\useNoteExport.ts

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type ExportFormat = 'PNG' | 'JPEG' | 'PDF';

export function useNoteExport() {
  /** 임시 DOM 생성 (노트 HTML 렌더링용) */
  const createTempContainer = (html: string) => {
    const container = document.createElement('div');
    container.innerHTML = html;

    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.padding = '24px';
    container.style.background = '#ffffff';
    container.style.boxSizing = 'border-box';

    container.style.lineHeight = '1.6';
    container.style.fontSize = '14px';

    /* 🔥 핵심: 줄 위/아래 여백을 강제로 확보 */
    container.style.paddingTop = '32px';
    container.style.paddingBottom = '32px';

    document.body.appendChild(container);

    container.querySelectorAll('li').forEach((li) => {
      (li as HTMLElement).style.marginBottom = '6px';
    });

    container.querySelectorAll('span, a, strong, em').forEach((el) => {
      (el as HTMLElement).style.lineHeight = '1.6';
    });
    return container;
  };

  const cleanup = (el: HTMLElement) => {
    document.body.removeChild(el);
  };

  /** 실제 export 함수 */
  const exportNote = async ({
    html,
    fileName,
    format,
  }: {
    html: string;
    fileName: string;
    format: ExportFormat;
  }) => {
    if (!html) return;

    const container = createTempContainer(html);

    try {
      if (format === 'PNG' || format === 'JPEG') {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });

        const mime = format === 'PNG' ? 'image/png' : 'image/jpeg';
        const ext = format === 'PNG' ? 'png' : 'jpeg';

        const dataUrl = canvas.toDataURL(mime, 0.95);
        download(dataUrl, `${fileName}.${ext}`);
      }

      if (format === 'PDF') {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });

        const pdf = new jsPDF('p', 'mm', 'a4');

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // 표준 여백 (mm)
        const marginTop = 15;
        const marginBottom = 15;
        const marginLeft = 15;
        const marginRight = 15;

        const PAGE_TOP_PADDING_MM = 8;
        const PAGE_BOTTOM_PADDING_MM = 12;
        const SAFE_OVERLAP_PX = 0;

        const usableWidth = pageWidth - marginLeft - marginRight;
        const usableHeight =
          pageHeight - marginTop - marginBottom - PAGE_BOTTOM_PADDING_MM;

        // canvas → pdf 비율
        const scale = usableWidth / canvas.width;
        const pageCanvasHeight = usableHeight / scale;

        let renderedHeight = 0;
        let pageIndex = 0;

        while (renderedHeight < canvas.height) {
          const sliceHeight = Math.min(
            pageCanvasHeight + SAFE_OVERLAP_PX,
            canvas.height - renderedHeight
          );

          const isFirstPage = pageIndex === 0;

          const sourceY = isFirstPage
            ? renderedHeight
            : renderedHeight + SAFE_OVERLAP_PX;

          const sourceHeight = isFirstPage
            ? sliceHeight
            : sliceHeight - SAFE_OVERLAP_PX;

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;

          const ctx = pageCanvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

          ctx.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sourceHeight,
            0,
            0,
            canvas.width,
            sourceHeight
          );

          const imgData = pageCanvas.toDataURL('image/png');

          if (pageIndex > 0) pdf.addPage();

          pdf.addImage(
            imgData,
            'PNG',
            marginLeft,
            marginTop + PAGE_TOP_PADDING_MM,
            usableWidth,
            sourceHeight * scale
          );

          renderedHeight += pageCanvasHeight - SAFE_OVERLAP_PX;
          pageIndex++;
        }

        pdf.save(`${fileName}.pdf`);
      }
    } finally {
      cleanup(container);
    }
  };

  return { exportNote };
}

/** 다운로드 유틸 */
function download(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}
