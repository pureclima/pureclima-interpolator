import React, { useState, useMemo } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
   PURECLIMA · PERFORMANCE CURVE INTERPOLATOR
   - User selects category (Diffuser, Ductwork, Fan, etc.)
   - Then selects curve type (parameters specific to that category)
   - Inputs data points and interpolates using Lagrange polynomial
   - Displays results with multiple outputs where relevant
   ────────────────────────────────────────────────────────────────────────── */

const CATEGORIES = {
  diffuser: {
    label: 'Diffuser',
    icon: '◇',
    curves: [
      { id: 'flow_pressure', label: 'Flow Rate vs Pressure Drop', xLabel: 'Flow (l/s)', yLabel: 'Pressure Drop (Pa)' },
      { id: 'flow_throw', label: 'Flow Rate vs Throw Distance', xLabel: 'Flow (l/s)', yLabel: 'Throw Distance (m)' },
      { id: 'flow_noise', label: 'Flow Rate vs Noise Level', xLabel: 'Flow (l/s)', yLabel: 'Noise (Nc rating)' },
    ],
  },
  ductwork: {
    label: 'Ductwork',
    icon: '⧉',
    curves: [
      { id: 'flow_pressure', label: 'Flow Rate vs Pressure Drop', xLabel: 'Flow (l/s)', yLabel: 'Pressure Drop (Pa/m)' },
      { id: 'diameter_flow', label: 'Duct Diameter vs Flow Capacity', xLabel: 'Diameter (mm)', yLabel: 'Flow (l/s)' },
      { id: 'velocity_pressure', label: 'Velocity vs Dynamic Pressure', xLabel: 'Velocity (m/s)', yLabel: 'Dynamic Pressure (Pa)' },
    ],
  },
  fan: {
    label: 'Fan',
    icon: '⊗',
    curves: [
      { id: 'flow_pressure', label: 'Flow Rate vs Total Pressure', xLabel: 'Flow (l/s)', yLabel: 'Total Pressure (Pa)' },
      { id: 'flow_power', label: 'Flow Rate vs Power Consumption', xLabel: 'Flow (l/s)', yLabel: 'Power (W)' },
      { id: 'flow_noise', label: 'Flow Rate vs Noise Level', xLabel: 'Flow (l/s)', yLabel: 'Noise (dB)' },
    ],
  },
  other: {
    label: 'Custom Curve',
    icon: '⊕',
    curves: [
      { id: 'custom', label: 'Custom Interpolation', xLabel: 'X Value', yLabel: 'Y Value' },
    ],
  },
};

/* ── Flow units ──
   Data is always stored in l/s. The display unit only changes what the user
   sees and types, so switching units converts existing points automatically. */
const FLOW_UNITS = {
  ls: { label: 'l/s', factor: 1 },
  m3h: { label: 'm³/h', factor: 3.6 }, // 1 l/s = 3.6 m³/h
};
const isFlowLabel = (label) => label.includes('(l/s)');
const unitLabel = (label, unit) => label.replace('(l/s)', `(${FLOW_UNITS[unit].label})`);
const toDisplay = (value, label, unit) => (isFlowLabel(label) ? value * FLOW_UNITS[unit].factor : value);
const fromDisplay = (value, label, unit) => (isFlowLabel(label) ? value / FLOW_UNITS[unit].factor : value);

/* ── Lagrange polynomial interpolation ── */
function lagrangeInterpolate(dataPoints, xTarget) {
  if (dataPoints.length === 0) return null;
  if (dataPoints.length === 1) return dataPoints[0].y;

  let result = 0;
  for (let i = 0; i < dataPoints.length; i++) {
    let term = dataPoints[i].y;
    for (let j = 0; j < dataPoints.length; j++) {
      if (i !== j) {
        term *= (xTarget - dataPoints[j].x) / (dataPoints[i].x - dataPoints[j].x);
      }
    }
    result += term;
  }
  return result;
}

/* ── Generate interpolation curve for plotting ── */
function generateCurve(dataPoints, xMin, xMax, steps = 100) {
  if (dataPoints.length < 2) return [];
  
  const sorted = [...dataPoints].sort((a, b) => a.x - b.x);
  const curve = [];
  const step = (xMax - xMin) / steps;
  
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * step;
    const y = lagrangeInterpolate(sorted, x);
    curve.push({ x, y });
  }
  return curve;
}

/* ── Chart component (SVG-based) ── */
function Chart({ dataPoints, xLabel, yLabel }) {
  const padding = { top: 40, right: 40, bottom: 60, left: 80 };
  const width = 600;
  const height = 400;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (dataPoints.length === 0) {
    return (
      <svg width={width} height={height} style={{ border: '1px solid #ddd', background: '#fafafa' }}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#999" fontSize="14">
          Add data points to generate curve
        </text>
      </svg>
    );
  }

  // Find axis bounds
  const xs = dataPoints.map(p => p.x);
  const ys = dataPoints.map(p => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  
  const xRange = xMax === xMin ? 1 : xMax - xMin;
  const yRange = yMax === yMin ? 1 : yMax - yMin;
  
  // Generate interpolation curve
  const curve = generateCurve(dataPoints, xMin, xMax, 150);
  
  // Scale functions
  const scaleX = (x) => padding.left + ((x - xMin) / xRange) * plotWidth;
  const scaleY = (y) => padding.top + plotHeight - ((y - yMin) / yRange) * plotHeight;
  
  // Path string for curve
  const pathData = curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)},${scaleY(p.y)}`)
    .join(' ');

  // Grid lines
  const gridLines = [];
  for (let i = 0; i <= 5; i++) {
    const y = yMin + (yRange / 5) * i;
    const yPos = scaleY(y);
    gridLines.push(
      <line key={`grid-${i}`} x1={padding.left} x2={width - padding.right} y1={yPos} y2={yPos} stroke="#eee" strokeDasharray="2,2" />
    );
  }

  return (
    <svg width={width} height={height} style={{ border: '1px solid #ddd', background: '#fafafa' }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#666" />
        </marker>
      </defs>

      {/* Grid */}
      {gridLines}

      {/* Axes */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#333" strokeWidth="2" markerEnd="url(#arrowhead)" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#333" strokeWidth="2" markerEnd="url(#arrowhead)" />

      {/* Axis labels */}
      <text x={width / 2} y={height - 10} textAnchor="middle" fontSize="12" fill="#333" fontWeight="500">
        {xLabel}
      </text>
      <text x={20} y={height / 2} textAnchor="middle" fontSize="12" fill="#333" fontWeight="500" transform={`rotate(-90, 20, ${height / 2})`}>
        {yLabel}
      </text>

      {/* Tick labels */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = yMin + (yRange / 5) * i;
        const yPos = scaleY(y);
        return (
          <text key={`y-label-${i}`} x={padding.left - 10} y={yPos + 4} textAnchor="end" fontSize="11" fill="#666">
            {y.toFixed(1)}
          </text>
        );
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = xMin + (xRange / 5) * i;
        const xPos = scaleX(x);
        return (
          <text key={`x-label-${i}`} x={xPos} y={height - padding.bottom + 20} textAnchor="middle" fontSize="11" fill="#666">
            {x.toFixed(1)}
          </text>
        );
      })}

      {/* Curve */}
      <path d={pathData} stroke="#C05746" strokeWidth="2.5" fill="none" vectorEffect="non-scaling-stroke" />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={`point-${i}`} cx={scaleX(p.x)} cy={scaleY(p.y)} r="4" fill="#C05746" stroke="#fff" strokeWidth="2" />
      ))}
    </svg>
  );
}

/* ── Main component ── */
export default function PureClimaInterpolator() {
  const [category, setCategory] = useState('diffuser');
  const [curveId, setCurveId] = useState('flow_pressure');
  const [dataPoints, setDataPoints] = useState([]);
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [queryX, setQueryX] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [flowUnit, setFlowUnit] = useState('ls');

  const currentCategory = CATEGORIES[category];
  const currentCurve = currentCategory.curves.find(c => c.id === curveId) || currentCategory.curves[0];
  const usesFlow = isFlowLabel(currentCurve.xLabel) || isFlowLabel(currentCurve.yLabel);
  const xLabel = unitLabel(currentCurve.xLabel, flowUnit);
  const yLabel = unitLabel(currentCurve.yLabel, flowUnit);
  const dispX = (v) => toDisplay(v, currentCurve.xLabel, flowUnit);
  const dispY = (v) => toDisplay(v, currentCurve.yLabel, flowUnit);

  // Auto-select first curve when category changes
  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setCurveId(CATEGORIES[newCategory].curves[0].id);
    setDataPoints([]);
    setQueryResult(null);
  };

  // Add data point
  const handleAddPoint = () => {
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    if (!isNaN(x) && !isNaN(y)) {
      setDataPoints([...dataPoints, {
        x: fromDisplay(x, currentCurve.xLabel, flowUnit),
        y: fromDisplay(y, currentCurve.yLabel, flowUnit),
      }]);
      setInputX('');
      setInputY('');
    }
  };

  // Remove data point
  const handleRemovePoint = (point) => {
    setDataPoints(dataPoints.filter((p) => p !== point));
  };

  // Query interpolator
  const handleQuery = () => {
    const x = parseFloat(queryX);
    if (!isNaN(x) && dataPoints.length >= 2) {
      const sorted = [...dataPoints].sort((a, b) => a.x - b.x);
      const xBase = fromDisplay(x, currentCurve.xLabel, flowUnit);
      const result = lagrangeInterpolate(sorted, xBase);
      setQueryResult({ x: xBase, result });
    }
  };

  // Sort data points by x for display
  const sortedDataPoints = [...dataPoints].sort((a, b) => a.x - b.x);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '30px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px', color: '#1a1a1a' }}>
          PureClima Performance Curve Interpolator
        </h1>
        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
          Import your data points and interpolate performance curves
        </p>
      </div>

      {/* Category selector */}
      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Use Case
        </label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: category === key ? '2px solid #C05746' : '1px solid #ddd',
                background: category === key ? '#fff' : '#f5f5f5',
                color: category === key ? '#C05746' : '#666',
                fontWeight: category === key ? '600' : '500',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ marginRight: '6px' }}>{cat.icon}</span>{cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Curve type selector */}
      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Curve Type
        </label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {currentCategory.curves.map((curve) => (
            <button
              key={curve.id}
              onClick={() => setCurveId(curve.id)}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: curveId === curve.id ? '2px solid #C05746' : '1px solid #ddd',
                background: curveId === curve.id ? '#fff' : '#f5f5f5',
                color: curveId === curve.id ? '#C05746' : '#666',
                fontWeight: curveId === curve.id ? '600' : '500',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {curve.label}
            </button>
          ))}
        </div>
      </div>

      {/* Flow unit selector */}
      {usesFlow && (
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Flow Units
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(FLOW_UNITS).map(([key, unit]) => (
              <button
                key={key}
                onClick={() => { setFlowUnit(key); setQueryX(''); }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: flowUnit === key ? '2px solid #C05746' : '1px solid #ddd',
                  background: flowUnit === key ? '#fff' : '#f5f5f5',
                  color: flowUnit === key ? '#C05746' : '#666',
                  fontWeight: flowUnit === key ? '600' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {unit.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data input */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Add Data Points
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>{xLabel}</label>
            <input
              type="number"
              value={inputX}
              onChange={(e) => setInputX(e.target.value)}
              placeholder="e.g., 100"
              onKeyPress={(e) => e.key === 'Enter' && handleAddPoint()}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>{yLabel}</label>
            <input
              type="number"
              value={inputY}
              onChange={(e) => setInputY(e.target.value)}
              placeholder="e.g., 50"
              onKeyPress={(e) => e.key === 'Enter' && handleAddPoint()}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleAddPoint}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              background: '#C05746',
              color: '#fff',
              fontWeight: '500',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.background = '#a84533'}
            onMouseLeave={(e) => e.target.style.background = '#C05746'}
          >
            Add
          </button>
        </div>
      </div>

      {/* Data table */}
      {dataPoints.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Data Points ({dataPoints.length})
          </label>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              background: '#fff',
              borderRadius: '6px',
              overflow: 'hidden',
            }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>{xLabel}</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>{yLabel}</th>
                  <th style={{ padding: '12px', width: '50px', textAlign: 'center' }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {sortedDataPoints.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px', color: '#333' }}>{dispX(p.x).toFixed(2)}</td>
                    <td style={{ padding: '12px', color: '#333' }}>{dispY(p.y).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleRemovePoint(p)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '3px',
                          border: 'none',
                          background: '#f0f0f0',
                          color: '#666',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#e0e0e0'}
                        onMouseLeave={(e) => e.target.style.background = '#f0f0f0'}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart */}
      {dataPoints.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Interpolation Curve
          </label>
          <div style={{ overflow: 'auto', background: '#fff', borderRadius: '6px', padding: '10px' }}>
            <Chart dataPoints={sortedDataPoints.map(p => ({ x: dispX(p.x), y: dispY(p.y) }))} xLabel={xLabel} yLabel={yLabel} />
          </div>
        </div>
      )}

      {/* Query interpolator */}
      {dataPoints.length >= 2 && (
        <div style={{ marginBottom: '30px', padding: '20px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Interpolate Value
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                Enter {xLabel}
              </label>
              <input
                type="number"
                value={queryX}
                onChange={(e) => setQueryX(e.target.value)}
                placeholder="e.g., 150"
                onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={handleQuery}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                background: '#C05746',
                color: '#fff',
                fontWeight: '500',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.background = '#a84533'}
              onMouseLeave={(e) => e.target.style.background = '#C05746'}
            >
              Calculate
            </button>
            {queryResult && (
              <div style={{
                padding: '8px 16px',
                borderRadius: '4px',
                background: '#f0f0f0',
                fontSize: '13px',
                fontWeight: '500',
                color: '#333',
              }}>
                {dispY(queryResult.result).toFixed(2)}
              </div>
            )}
          </div>
          {queryResult && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#fff', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', color: '#333' }}>
              <strong>Result:</strong> At {xLabel} = {dispX(queryResult.x).toFixed(2)}, {yLabel} = <strong>{dispY(queryResult.result).toFixed(2)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '6px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
        <strong>How to use:</strong><br />
        1. Select your use case (Diffuser, Ductwork, Fan, or Custom)<br />
        2. Choose the curve type relevant to your application<br />
        3. Choose l/s or m³/h for flow, then add your measured or reference data points<br />
        4. The tool generates a polynomial interpolation curve through your data<br />
        5. Use &lsquo;Interpolate Value&rsquo; to estimate results between your data points
      </div>
    </div>
  );
}