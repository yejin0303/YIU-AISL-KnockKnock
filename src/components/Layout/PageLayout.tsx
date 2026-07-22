// src/components/Layout/PageLayout.tsx
import React from 'react';
import './PageLayout.css';

interface PageLayoutProps {
  title: string;
  subtitle: string;
  headerActions?: React.ReactNode;
  sidebar?: React.ReactNode;
  mainContent: React.ReactNode;
  modals?: React.ReactNode; // 모달들을 위한 영역
}

const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subtitle,
  headerActions,
  sidebar,
  mainContent,
  modals,
}) => {
  return (
    <div className="page-wrapper">
      <div className="page-root">
        <div className="page-canvas">
          {/* 상단 헤더 */}
          <div className="page-header-row">
            <header className="page-header">
              <h1 className="page-title">{title}</h1>
              <p className="page-subtitle">{subtitle}</p>
            </header>

            {headerActions && (
              <div className="page-header-actions">{headerActions}</div>
            )}
          </div>

          {/* 메인 레이아웃: 사이드바 + 컨텐츠 */}
          <div className="page-main-layout">
            {sidebar}
            {mainContent}
          </div>
        </div>
      </div>

      {/* 모달 영역 */}
      {modals}
    </div>
  );
};

export default PageLayout;
