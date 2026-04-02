'use client'

import React, { useRef, useEffect, useState } from 'react';
import { Chart, ChartConfiguration, ChartData, registerables, ScatterDataPoint } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

type CircuitChartProps = {
    circuitName: string;
    sensorData: Record<string, [string, string | number][]>;
    isModal?: boolean;
};

// 温度用の色
const tempColors = [
    'rgb(255, 206, 86)',
    'rgb(255, 159, 64)',
    'rgb(255, 99, 71)',
];
// 電流用の色
const currColors = [
    'rgb(54, 162, 235)',
    'rgb(30, 144, 255)',
    'rgb(0, 100, 200)',
];
// 電圧用の色
const voltColors = [
    'rgb(75, 192, 192)',
    'rgb(50, 205, 50)',
    'rgb(34, 139, 34)',
];
// 漏洩電流用の色 - kotani (2026-04-02)
const leakColors = [
    'rgb(54, 162, 235)',
    'rgb(30, 144, 255)',
    'rgb(0, 100, 200)',
];

// 有効な数値かどうかをチェックする関数
const isValidNumber = (value: any): boolean => {
    return value !== null && 
           value !== undefined && 
           !isNaN(Number(value)) && 
           isFinite(Number(value));
};

const CircuitChart: React.FC<CircuitChartProps> = ({ circuitName, sensorData, isModal = false }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    const [currentTemp, setCurrentTemp] = useState<number | null>(null);
    const [currentCurr, setCurrentCurr] = useState<number | null>(null);
    const [currentVolt, setCurrentVolt] = useState<number | null>(null);
    // 漏洩電流 - kotani (2026-04-02)
    const [currentLeak, setCurrentLeak] = useState<number | null>(null);

    useEffect(() => { 
        const calculateValues = () => {
            let tempValues: number[] = [];
            let currValues: number[] = [];
            let voltValues: number[] = [];
            let hasTemp = false;
            let hasCurr = false;
            let hasVolt = false;
            // 漏洩電流 - kotani (2026-04-02)
            let leakValues: number[] = [];
            let hasLeak = false;

            Object.entries(sensorData).forEach(([sensorKey, data]) => {
                if (sensorKey.startsWith('temp') && !sensorKey.startsWith('tempState')) {
                    hasTemp = true;
                    const tempValue = data.length > 0 ? data[data.length - 1][1] : null;
                    if (tempValue !== null && isValidNumber(tempValue)) tempValues.push(Number(tempValue));
                } else if (sensorKey.startsWith('curr') && !sensorKey.startsWith('currState')) {
                    hasCurr = true;
                    const currValue = data.length > 0 ? data[data.length - 1][1] : null;
                    if (currValue !== null && isValidNumber(currValue)) currValues.push(Number(currValue));
                } else if (sensorKey.startsWith('volt') && !sensorKey.startsWith('voltState')) {
                    hasVolt = true;
                    const voltValue = data.length > 0 ? data[data.length - 1][1] : null;
                    if (voltValue !== null && isValidNumber(voltValue)) voltValues.push(Number(voltValue));
                // 漏洩電流 - kotani (2026-04-02)
                } else if (sensorKey.startsWith('leak') && !sensorKey.startsWith('leakState')) {
                    hasLeak = true;
                    const leakValue = data.length > 0 ? data[data.length - 1][1] : null;
                    if (leakValue !== null && isValidNumber(leakValue)) leakValues.push(Number(leakValue));
                }
            });

            setCurrentTemp(hasTemp ? (tempValues.length > 0 ? Math.max(...tempValues) : 0) : null);
            setCurrentCurr(hasCurr ? (currValues.length > 0 ? Math.max(...currValues) : 0) : null);
            setCurrentVolt(hasVolt ? (voltValues.length > 0 ? Math.max(...voltValues) : 0) : null);
            // 漏洩電流 - kotani (2026-04-02)
            setCurrentLeak(hasLeak ? (leakValues.length > 0 ? Math.max(...leakValues) : 0) : null);
        };

        calculateValues();

        if (chartRef.current) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                if (chartInstanceRef.current) {
                    chartInstanceRef.current.destroy();
                }

                const isMainCircuit = circuitName === '主幹';
                let tempIndex = 0;
                let currIndex = 0;
                let voltIndex = 0;
                // 漏洩電流 - kotani (2026-04-02)
                const isAirTempCircuit = circuitName === '盤内温度';
                let leakIndex = 0;  

                const datasets = Object.entries(sensorData)
                .filter(([sensorKey]) => {
                    if (isMainCircuit) {
                        return (sensorKey.startsWith('temp') && !sensorKey.startsWith('tempState')) ||
                               (sensorKey.startsWith('volt') && !sensorKey.startsWith('voltState'));
                    }
                    // 漏洩電流 - kotani (2026-04-02)
                    if (isAirTempCircuit) {
                        return (sensorKey.startsWith('temp') && !sensorKey.startsWith('tempState')) ||
                               (sensorKey.startsWith('leak') && !sensorKey.startsWith('leakState'));
                    }
                    return (sensorKey.startsWith('temp') && !sensorKey.startsWith('tempState')) || 
                           (sensorKey.startsWith('curr') && !sensorKey.startsWith('currState'));
                })
                .map(([sensorKey, data]) => {
                    const sensorLabel = sensorKey.startsWith('temp') && !sensorKey.startsWith('tempState')
                        ? `温度 ${sensorKey.slice(4)}`
                        : sensorKey.startsWith('curr') && !sensorKey.startsWith('currState')
                        ? `電流 ${sensorKey.slice(4)}`
                        : sensorKey.startsWith('volt') && !sensorKey.startsWith('voltState')
                        ? `電圧 ${sensorKey.slice(4)}`
                        // 漏洩電流 - kotani (2026-04-02)
                        : sensorKey.startsWith('leak') && !sensorKey.startsWith('leakState')
                        ? `漏洩電流 ${sensorKey.slice(4)}`
                        : sensorKey;

                    let yAxisID: string;
                    let borderColor: string;
                    if (sensorKey.startsWith('temp') && !sensorKey.startsWith('tempState')) {
                        yAxisID = 'y-temp';
                        borderColor = tempColors[tempIndex % tempColors.length];
                        tempIndex++;
                    } else if (sensorKey.startsWith('curr') && !sensorKey.startsWith('currState')) {
                        yAxisID = 'y-curr';
                        borderColor = currColors[currIndex % currColors.length];
                        currIndex++;
                    } else if (sensorKey.startsWith('volt') && !sensorKey.startsWith('voltState')) {
                        yAxisID = 'y-volt';
                        borderColor = voltColors[voltIndex % voltColors.length];
                        voltIndex++;
                    // 漏洩電流 - kotani (2026-04-02)
                    } else if (sensorKey.startsWith('leak') && !sensorKey.startsWith('leakState')) {
                        yAxisID = 'y-leak';
                        borderColor = leakColors[leakIndex % leakColors.length];
                        leakIndex++;
                    // エラー - kotani (2026-04-02)
                    } else {
                        yAxisID = 'y-unknown';
                        borderColor = 'gray';
                    }

                    return {
                        label: sensorLabel,
                        data: data
                            .filter(([_, value]) => isValidNumber(value))
                            .map(([timestamp, value]) => ({
                                x: new Date(timestamp).getTime(),
                                y: Number(value),
                            })) as ScatterDataPoint[],
                        fill: false,
                        borderColor,
                        tension: 0.1,
                        yAxisID,
                    };
                });

                const chartData: ChartData<'line'> = {
                    datasets,
                };

                const options: ChartConfiguration['options'] = {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    elements: {
                        point: { radius: 0, hitRadius: 10 },
                    },
                    scales: {
                        'y-temp': {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: '温度 [°C]' },
                            min: 0,
                            max: 100,
                            ticks: { font: { size: 14 } },
                        },
                        'y-curr': {
                            type: 'linear',
                            display: !isMainCircuit,
                            position: 'right',
                            title: { display: true, text: '電流 [A]' },
                            grid: { drawOnChartArea: false },
                            min: 0,
                            ticks: { font: { size: 14 } },
                            afterDataLimits: (scale) => {
                                const { max } = scale;
                                scale.min = 0;
                                scale.max = max * 1.5;
                            }
                        },
                        'y-volt': {
                            type: 'linear',
                            display: isMainCircuit,
                            position: 'right',
                            title: { display: true, text: '電圧 [V]' },
                            grid: { drawOnChartArea: false },
                            min: 0,
                            ticks: { font: { size: 14 } },
                            afterDataLimits: (scale) => {
                                const { max } = scale;
                                scale.min = 0;
                                scale.max = max > 0 ? max * 1.2 : 250;
                            }
                        },
                        // 漏洩電流 - kotani (2026-04-02)
                        'y-leak': {
                            type: 'linear',
                            display: isAirTempCircuit,
                            position: 'right',
                            title: { display: true, text: '漏洩電流 [mA]' },
                            grid: { drawOnChartArea: false },
                            min: 0,
                            ticks: { font: { size: 14 } },
                        },
                        x: {
                            type: 'time',
                            time: { unit: 'minute' },
                            ticks: { font: { size: 10 } },
                        },
                    },
                    plugins: {
                        legend: {
                            display: false,
                        },
                    },
                };

                chartInstanceRef.current = new Chart(ctx, {
                    type: 'line',
                    data: chartData,
                    options: options,
                });
            }
        }

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [sensorData]);

    const formatValue = (value: number | null): string => {
        if (value === null || !isValidNumber(value) || value === Infinity || value === -Infinity || isNaN(Number(value))) {
            return '-';
        }
        return value.toFixed(1);
    };

    const hasTemp = Object.keys(sensorData).some(key => key.startsWith('temp') && !key.startsWith('tempState'));
    const hasCurr = Object.keys(sensorData).some(key => key.startsWith('curr') && !key.startsWith('currState'));
    const hasVolt = Object.keys(sensorData).some(key => key.startsWith('volt') && !key.startsWith('voltState'));
    // 漏洩電流 - kotani (2026-04-02)
    const hasLeak = Object.keys(sensorData).some(key => key.startsWith('leak') && !key.startsWith('leakState'));

    const getDisplayTempColors = (): string[] => {
        const colors: string[] = [];
        let index = 0;
        Object.keys(sensorData).forEach((key) => {
            if (key.startsWith('temp') && !key.startsWith('tempState')) {
                colors.push(tempColors[index % tempColors.length]);
                index++;
            }
        });
        return colors;
    };
    const getDisplayCurrColors = (): string[] => {
        const colors: string[] = [];
        let index = 0;
        Object.keys(sensorData).forEach((key) => {
            if (key.startsWith('curr') && !key.startsWith('currState')) {
                colors.push(currColors[index % currColors.length]);
                index++;
            }
        });
        return colors;
    };
    const getDisplayVoltColors = (): string[] => {
        const colors: string[] = [];
        let index = 0;
        Object.keys(sensorData).forEach((key) => {
            if (key.startsWith('volt') && !key.startsWith('voltState')) {
                colors.push(voltColors[index % voltColors.length]);
                index++;
            }
        });
        return colors;
    };
    // 漏洩電流 - kotani (2026-04-02)
    const getDisplayLeakColors = (): string[] => {
        const colors: string[] = [];
        let index = 0;
        Object.keys(sensorData).forEach((key) => {
            if (key.startsWith('leak') && !key.startsWith('leakState')) {
                colors.push(leakColors[index % leakColors.length]);
                index++;
            }
        });
        return colors;
    };

    const displayTempColors = getDisplayTempColors();
    const displayCurrColors = getDisplayCurrColors();
    const displayVoltColors = getDisplayVoltColors();
    // 漏洩電流 - kotani (2026-04-02)
    const displayLeakColors = getDisplayLeakColors();

    const getSensorValues = () => {
        const tempSensors: Array<{ number: string; value: number; color: string }> = [];
        const currSensors: Array<{ number: string; value: number; color: string }> = [];
        const voltSensors: Array<{ number: string; value: number; color: string }> = [];
        // 漏洩電流 - kotani (2026-04-02)
        const leakSensors: Array<{ number: string; value: number; color: string }> = [];
        Object.entries(sensorData).forEach(([sensorKey, data]) => {
            if (sensorKey.startsWith('temp') && !sensorKey.startsWith('tempState')) {
                const sensorNumber = sensorKey.slice(4);
                const tempValue = data.length > 0 ? data[data.length - 1][1] : null;
                if (tempValue !== null && isValidNumber(tempValue)) {
                    tempSensors.push({
                        number: sensorNumber,
                        value: Number(tempValue),
                        color: tempColors[tempSensors.length % tempColors.length]
                    });
                }
            } else if (sensorKey.startsWith('curr') && !sensorKey.startsWith('currState')) {
                const sensorNumber = sensorKey.slice(4);
                const currValue = data.length > 0 ? data[data.length - 1][1] : null;
                if (currValue !== null && isValidNumber(currValue)) {
                    currSensors.push({
                        number: sensorNumber,
                        value: Number(currValue),
                        color: currColors[currSensors.length % currColors.length]
                    });
                }
            } else if (sensorKey.startsWith('volt') && !sensorKey.startsWith('voltState')) {
                const sensorNumber = sensorKey.slice(4);
                const voltValue = data.length > 0 ? data[data.length - 1][1] : null;
                if (voltValue !== null && isValidNumber(voltValue)) {
                    voltSensors.push({
                        number: sensorNumber,
                        value: Number(voltValue),
                        color: voltColors[voltSensors.length % voltColors.length]
                    });
                }
            // 漏洩電流 - kotani (2026-04-02)
            } else if (sensorKey.startsWith('leak') && !sensorKey.startsWith('leakState')) {
                const sensorNumber = sensorKey.slice(4);
                const leakValue = data.length > 0 ? data[data.length - 1][1] : null;
                if (leakValue !== null && isValidNumber(leakValue)) {
                    leakSensors.push({
                        number: sensorNumber,
                        value: Number(leakValue),
                        color: leakColors[leakSensors.length % leakColors.length]
                    });
                }
            }
        });
        // 漏洩電流 - kotani (2026-04-02)
        return { tempSensors, currSensors, voltSensors, leakSensors };
    };

    // 漏洩電流 - kotani (2026-04-02)
    const { tempSensors, currSensors, voltSensors, leakSensors } = isModal ? getSensorValues() : { tempSensors: [], currSensors: [], voltSensors: [], leakSensors: [] };

    return (
        <div className={`h-full flex flex-col rounded-lg p-1 bg-gradient-to-br from-gray-50 to-white`}>
            <div className="flex flex-col items-center gap-0.5">
                {isModal ? (
                    <>
                        {tempSensors.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap bg-orange-50 px-3 py-2 rounded-lg">
                                {tempSensors.map((sensor) => (
                                    <div key={`temp-${sensor.number}`} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded shadow-md">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sensor.color }} />
                                        <p className="text-sm whitespace-nowrap">温度{sensor.number}: <span className="text-base font-bold text-orange-600">{formatValue(sensor.value)}</span> °C</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {currSensors.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap bg-blue-50 px-3 py-2 rounded-lg">
                                {currSensors.map((sensor) => (
                                    <div key={`curr-${sensor.number}`} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded shadow-md">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sensor.color }} />
                                        <p className="text-sm whitespace-nowrap">電流{sensor.number}: <span className="text-base font-bold text-blue-600">{formatValue(sensor.value)}</span> A</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {voltSensors.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap bg-green-50 px-3 py-2 rounded-lg">
                                {voltSensors.map((sensor) => (
                                    <div key={`volt-${sensor.number}`} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded shadow-md">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sensor.color }} />
                                        <p className="text-sm whitespace-nowrap">電圧{sensor.number}: <span className="text-base font-bold text-green-600">{formatValue(sensor.value)}</span> V</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* 漏洩電流 - kotani (2026-04-02) */}
                        {leakSensors.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap bg-red-50 px-3 py-2 rounded-lg">
                                {leakSensors.map((sensor) => (
                                    <div key={`leak-${sensor.number}`} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded shadow-md">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sensor.color }} />
                                        <p className="text-sm whitespace-nowrap">漏洩電流{sensor.number}: <span className="text-base font-bold text-red-600">{formatValue(sensor.value)}</span> mA</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {hasTemp && (
                            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-50 to-red-50 px-1.5 py-0.5 rounded shadow-sm">
                                <div className="flex gap-0.5">
                                    {displayTempColors.map((color, index) => (
                                        <div key={`temp-${index}`} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                                <p className="text-xs font-medium">現在の温度: <span className="text-xs font-bold text-orange-600">{formatValue(currentTemp)}</span> °C</p>
                            </div>
                        )}
                        {hasCurr && (
                            <div className="flex items-center gap-1 bg-gradient-to-r from-blue-50 to-cyan-50 px-1.5 py-0.5 rounded shadow-sm">
                                <div className="flex gap-0.5">
                                    {displayCurrColors.map((color, index) => (
                                        <div key={`curr-${index}`} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                                <p className="text-xs font-medium">現在の電流: <span className="text-xs font-bold text-blue-600">{formatValue(currentCurr)}</span> A</p>
                            </div>
                        )}
                        {hasVolt && (
                            <div className="flex items-center gap-1 bg-gradient-to-r from-green-50 to-emerald-50 px-1.5 py-0.5 rounded shadow-sm">
                                <div className="flex gap-0.5">
                                    {displayVoltColors.map((color, index) => (
                                        <div key={`volt-${index}`} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                                <p className="text-xs font-medium">現在の電圧: <span className="text-xs font-bold text-green-600">{formatValue(currentVolt)}</span> V</p>
                            </div>
                        )}
                        {/* 漏洩電流 - kotani (2026-04-02) */}
                        {hasLeak && (
                            <div className="flex items-center gap-1 bg-gradient-to-r from-red-50 to-pink-50 px-1.5 py-0.5 rounded shadow-sm">
                                <div className="flex gap-0.5">
                                    {displayLeakColors.map((color, index) => (
                                        <div key={`leak-${index}`} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                                <p className="text-xs font-medium">現在の漏洩電流: <span className="text-xs font-bold text-red-600">{formatValue(currentLeak)}</span> mA</p>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className="flex-grow">
                <canvas ref={chartRef} className="w-full h-full"/>
            </div>
        </div>
    );
};

export default CircuitChart;
