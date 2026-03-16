'use client'

import React, { useRef, useEffect, useState } from 'react';
import { Chart, ChartConfiguration, ChartData, registerables, ScatterDataPoint } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

type VoltageChartProps = {
    circuitName: string;
    sensorData: Record<string, [string, string | number][]>;
};

const fixedColors = [
    'rgb(255, 99, 132)',   // 赤
    'rgb(54, 162, 235)',   // 青
    'rgb(255, 206, 86)',   // 黄
    'rgb(75, 192, 192)',   // 緑
    'rgb(153, 102, 255)',  // 紫
    'rgb(255, 159, 64)',   // オレンジ
    'rgb(201, 203, 207)',  // グレー
];

// 有効な数値かどうかをチェックする関数
const isValidNumber = (value: any): boolean => {
    return value !== null && 
           value !== undefined && 
           !isNaN(Number(value)) && 
           isFinite(Number(value));
};

const VoltageChart: React.FC<VoltageChartProps> = ({ circuitName, sensorData }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    const [currentVoltage, setCurrentVoltage] = useState<number | null>(null);
    const [maxVoltage, setMaxVoltage] = useState<number | null>(null);
    const [minVoltage, setMinVoltage] = useState<number | null>(null);

    useEffect(() => { 
        const calculateValues = () => {
            let voltageValues: number[] = [];

            Object.entries(sensorData).forEach(([sensorKey, data]) => {
                if (sensorKey.startsWith('volt') && !sensorKey.startsWith('voltState')) {
                    const voltValue = data.length > 0 ? data[data.length - 1][1] : null;
                    if (voltValue !== null && isValidNumber(voltValue)) {
                        voltageValues.push(Number(voltValue));
                    }
                }
            });

            if (voltageValues.length > 0) {
                setCurrentVoltage(voltageValues[voltageValues.length - 1]);
                setMaxVoltage(Math.max(...voltageValues));
                setMinVoltage(Math.min(...voltageValues));
            } else {
                setCurrentVoltage(null);
                setMaxVoltage(null);
                setMinVoltage(null);
            }
        };

        calculateValues();

        if (chartRef.current) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                if (chartInstanceRef.current) {
                    chartInstanceRef.current.destroy();
                }

                const datasets = Object.entries(sensorData)
                .filter(([sensorKey]) => sensorKey.startsWith('volt') && !sensorKey.startsWith('voltState'))
                .map(([sensorKey, data], index) => {
                    const sensorLabel = `電圧 ${sensorKey.slice(4)}`;

                    return {
                        label: sensorLabel,
                        data: data
                            .filter(([_, value]) => isValidNumber(value))
                            .map(([timestamp, value]) => ({
                                x: new Date(timestamp).getTime(),
                                y: Number(value),
                            })) as ScatterDataPoint[],
                        fill: false,
                        borderColor: fixedColors[index % fixedColors.length],
                        tension: 0.1,
                        yAxisID: 'y-volt',
                    };
                });

                const chartData: ChartData<'line'> = {
                    datasets,
                };

                const options: ChartConfiguration['options'] = {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 0 // アニメーションを無効化
                    },
                    elements: {
                        point: {
                            radius: 0, // ポイントを非表示にする
                            hitRadius: 10, // ホバー検出用の半径を設定
                        }
                    },
                    scales: {
                        'y-volt': {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: '電圧 [V]',
                            },
                            min: 0,
                            ticks: {
                                font: {
                                    size: 14,
                                },
                            },
                            afterDataLimits: (scale) => {
                                const { max } = scale;
                                // 電圧の場合、最大値の1.2倍を上限とする
                                scale.min = 0;
                                scale.max = max > 0 ? max * 1.2 : 250; // デフォルト250V
                            }
                        },
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                                displayFormats: {
                                    minute: 'HH:mm',
                                },
                            },
                            title: {
                                display: true,
                                text: '時刻',
                            },
                            ticks: {
                                font: {
                                    size: 14,
                                },
                            },
                        },
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: {
                                    size: 14,
                                },
                            },
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y.toFixed(1) + ' V';
                                    }
                                    return label;
                                }
                            }
                        },
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    },
                };

                const config: ChartConfiguration = {
                    type: 'line',
                    data: chartData,
                    options,
                };

                chartInstanceRef.current = new Chart(ctx, config);
            }
        }

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [sensorData]);

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{circuitName}</h3>
                <div className="flex gap-4 text-sm">
                    {currentVoltage !== null && (
                        <div className="flex flex-col items-end">
                            <span className="text-gray-500">現在値</span>
                            <span className="text-xl font-bold text-blue-600">
                                {currentVoltage.toFixed(1)} V
                            </span>
                        </div>
                    )}
                    {maxVoltage !== null && (
                        <div className="flex flex-col items-end">
                            <span className="text-gray-500">最大値</span>
                            <span className="text-lg font-semibold text-red-500">
                                {maxVoltage.toFixed(1)} V
                            </span>
                        </div>
                    )}
                    {minVoltage !== null && (
                        <div className="flex flex-col items-end">
                            <span className="text-gray-500">最小値</span>
                            <span className="text-lg font-semibold text-green-500">
                                {minVoltage.toFixed(1)} V
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <div style={{ height: '300px' }}>
                <canvas ref={chartRef}></canvas>
            </div>
        </div>
    );
};

export default VoltageChart;
