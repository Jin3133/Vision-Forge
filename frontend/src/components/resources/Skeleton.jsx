// src/components/resources/Skeleton.jsx
// 资源中心 Skeleton：卡片骨架 + 详情骨架

import React from 'react';

const base = {
  background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
  backgroundSize: '200% 100%',
  animation: 'sk-shimmer 1.4s infinite linear',
  borderRadius: 6,
};

export function ResourceCardSkeleton() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      border: '1px solid #f1f5f9',
    }}>
      <div style={{ ...base, height: 90, borderRadius: 0 }} />
      <div style={{ padding: 14 }}>
        <div style={{ ...base, height: 14, width: '78%', marginBottom: 10 }} />
        <div style={{ ...base, height: 11, width: '100%', marginBottom: 6 }} />
        <div style={{ ...base, height: 11, width: '60%', marginBottom: 14 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ ...base, height: 10, width: '40%' }} />
          <div style={{ ...base, height: 10, width: '24%' }} />
        </div>
        <div style={{ ...base, height: 32, width: '100%', borderRadius: 10 }} />
      </div>
      <style>{`
        @keyframes sk-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function ResourceGridSkeleton({ count = 6 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => <ResourceCardSkeleton key={i} />)}
    </div>
  );
}

export function ModuleContentSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
      <div style={{ ...base, height: 20, width: '60%', marginBottom: 14 }} />
      <div style={{ ...base, height: 12, width: '100%', marginBottom: 8 }} />
      <div style={{ ...base, height: 12, width: '90%', marginBottom: 8 }} />
      <div style={{ ...base, height: 12, width: '70%', marginBottom: 18 }} />
      <div style={{ ...base, height: 14, width: '40%', marginBottom: 10 }} />
      <div style={{ ...base, height: 80, width: '100%', marginBottom: 14, borderRadius: 8 }} />
      <div style={{ ...base, height: 12, width: '100%', marginBottom: 8 }} />
      <div style={{ ...base, height: 12, width: '85%' }} />
      <style>{`
        @keyframes sk-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}