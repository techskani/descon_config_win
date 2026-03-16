'use client'

import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface TrackingChartProps {
  trackingData: {
    deviceName: string;
    ch: number;
    peakCurrent: number;
    values: number[];
    timestamp: string;
  };
  onClose: () => void;
  circuitName: string;
}

const TrackingChart: React.FC<TrackingChartProps> = ({ trackingData, onClose, circuitName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const maxCurrent = Math.max(...trackingData.values);
  const peakCurrent = trackingData.peakCurrent;

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        chartRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: Array.from({ length: trackingData.values.length }, (_, i) => i * 0.08333), // x軸のラベルを設定（例：0.08333秒ごと）
            datasets: [
              {
                label: 'Tracking Data',
                data: trackingData.values,
                borderColor: 'rgba(255,0,0,1)', // 赤色に変更
                backgroundColor: 'rgba(255,0,0,0.2)', // 赤色の背景
                fill: false,
                pointRadius: 1, // プロットの点を小さく設定
                borderWidth: 1, // 線を細く設定
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'linear',
                position: 'bottom',
                title: {
                  display: true,
                  text: 'time [msec]',
                },
              },
              y: {
                title: {
                  display: true,
                  text: '電流 [A]',
                },
                min: -100,
                max: 150,
              },
            },
          },
        });
      }
    }
  }, [trackingData]);

  return (
    <div className="bg-red-100 border-4 border-red-500 p-4 rounded-lg shadow-lg flex flex-col relative">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold text-red-600">デバイス名: {trackingData.deviceName}</h3>
          <p className="text-md font-semibold text-red-600">回路名: {circuitName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 bg-red-500 text-white rounded hover:bg-red-700 text-sm"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <p className="text-md font-semibold text-red-600">
            発生時刻: {new Date(trackingData.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-md font-semibold text-red-600">
            ピーク電流: <span className="text-xl font-bold">{peakCurrent.toFixed(2)} A</span>
          </p>
        </div>
      </div>
      <div className="h-64"> {/* グラフの高さを固定 */}
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default TrackingChart;