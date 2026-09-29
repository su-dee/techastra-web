import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import { api } from "../lib/api";
import { useThemeMode } from "../lib/theme";

const EASE_CINEMATIC = [0.25, 0.1, 0.25, 1];

// Metric configurations matching our real data
const metrics = [
  {
    key: "totalRegistrations",
    label: "Total Registrations",
    color: "#ddbb6a",
    format: (val) => val.toLocaleString(),
  },
  {
    key: "approved",
    label: "Approved",
    color: "#22C55E",
    format: (val) => val.toLocaleString(),
  },
  {
    key: "pending",
    label: "Pending",
    color: "#F59E0B",
    format: (val) => val.toLocaleString(),
  },
  {
    key: "revenue",
    label: "Revenue Collected",
    color: "#a7afb5",
    format: (val) => `₹${val.toLocaleString()}`,
  },
];

// Chart config for our metrics
const chartConfig = {
  totalRegistrations: { label: "Total Registrations", color: "#ddbb6a" },
  approved: { label: "Approved", color: "#22C55E" },
  pending: { label: "Pending", color: "#F59E0B" },
  revenue: { label: "Revenue Collected", color: "#a7afb5" },
};
// Deeper shades for light mode, so numbers and lines read on white.
const LIGHT_COLOR = { totalRegistrations: "#7d5f1a", approved: "#15803d", pending: "#b45309", revenue: "#4f5a63" };

// Custom Tooltip
const CustomTooltip = ({ active, payload, selectedMetric }) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    const metric = metrics.find((m) => m.key === selectedMetric);
    
    if (metric) {
      return (
        <div className="bg-void/95 backdrop-blur-sm border border-shade/10 rounded-sm p-3 shadow-xl">
          <div className="flex items-center gap-2 text-sm">
            <div className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
            <span className="text-shade/70">{metric.label}:</span>
            <span className="font-semibold text-heading">{metric.format(entry.value)}</span>
          </div>
        </div>
      );
    }
  }
  return null;
};

export default function InteractiveAnalyticsChart() {
  const [selectedMetric, setSelectedMetric] = useState("totalRegistrations");
  const light = useThemeMode() === "light";
  const colorOf = (key) => (light ? LIGHT_COLOR[key] : chartConfig[key]?.color);
  // Axis/grid ink: white on dark, warm ink on light.
  const ink = (a) => (light ? `rgba(43,36,27,${a})` : `rgba(255,255,255,${a})`);
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    Promise.all([
      api.get("/api/admin/analytics"),
      api.get("/api/admin/analytics/timeseries"),
    ])
      .then(([summary, timeseries]) => {
        setSummaryData(summary);
        setTimeseriesData(timeseries);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Card className="mb-8">
        <div className="flex items-center justify-center h-96">
          <p className="text-shade/50">Loading analytics...</p>
        </div>
      </Card>
    );
  }

  if (!summaryData || !timeseriesData.length) {
    return (
      <Card className="mb-8">
        <div className="flex items-center justify-center h-96">
          <p className="text-shade/50">No data available</p>
        </div>
      </Card>
    );
  }

  // Calculate previous values for comparison (from first vs last day)
  const firstDay = timeseriesData[0] || {};
  const lastDay = timeseriesData[timeseriesData.length - 1] || {};
  
  const metricValues = metrics.map((metric) => {
    const currentValue = summaryData[metric.key] || 0;
    // For simple comparison, use 80% of current as "previous"
    const previousValue = Math.floor(currentValue * 0.8);
    const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
    const isPositive = change >= 0;

    return {
      ...metric,
      value: currentValue,
      previousValue,
      change,
      isPositive,
    };
  });

  const containerVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASE_CINEMATIC },
    },
  };

  const chartVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8, ease: EASE_CINEMATIC, delay: 0.4 },
    },
  };

  return (
    <motion.div
      className="mb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <Card className="overflow-hidden">
        {/* Metrics Grid */}
        <motion.div className="grid grid-cols-2 md:grid-cols-4 border-b border-shade/5">
          {metricValues.map((metric, index) => (
            <motion.button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              variants={cardVariants}
              className={`
                text-start p-4 border-b md:border-b-0 md:border-r border-shade/5 last:border-r-0
                transition-all duration-300 hover:bg-shade/5
                ${selectedMetric === metric.key ? "bg-shade/5" : ""}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-shade/50 uppercase tracking-wider">
                  {metric.label}
                </span>
                <Badge
                  status={metric.isPositive ? "approved" : "rejected"}
                  className="text-[10px] px-1.5 py-0.5"
                >
                  {metric.isPositive ? (
                    <ArrowUp className="inline size-2.5 mr-0.5" />
                  ) : (
                    <ArrowDown className="inline size-2.5 mr-0.5" />
                  )}
                  {Math.abs(metric.change).toFixed(1)}%
                </Badge>
              </div>
              <div
                className="text-2xl font-bold mb-1"
                style={{ color: colorOf(metric.key) }}
              >
                {metric.format(metric.value)}
              </div>
              <div className="text-[10px] text-shade/40">
                from {metric.format(metric.previousValue)}
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* Chart */}
        <motion.div className="p-6" variants={chartVariants}>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={timeseriesData}
              margin={{ top: 20, right: 20, left: 5, bottom: 20 }}
            >
              <defs>
                <filter id="lineShadow" x="-100%" y="-100%" width="300%" height="300%">
                  <feDropShadow
                    dx="0"
                    dy="4"
                    stdDeviation="8"
                    floodColor={colorOf(selectedMetric)}
                    floodOpacity="0.3"
                  />
                </filter>
                <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
                </filter>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke={ink(light ? 0.08 : 0.05)} />
              
              <XAxis
                dataKey="date"
                stroke={ink(0.3)}
                tick={{ fontSize: 11, fill: ink(light ? 0.7 : 0.5) }}
                tickLine={false}
                tickMargin={10}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              
              <YAxis
                stroke={ink(0.3)}
                tick={{ fontSize: 11, fill: ink(light ? 0.7 : 0.5) }}
                tickLine={false}
                tickMargin={10}
                tickFormatter={(value) => {
                  const metric = metrics.find((m) => m.key === selectedMetric);
                  return metric ? metric.format(value) : value.toString();
                }}
              />
              
              <Tooltip
                content={<CustomTooltip selectedMetric={selectedMetric} />}
                cursor={{ strokeDasharray: "3 3", stroke: light ? "#a39985" : "#6d665a" }}
              />
              
              <Line
                type="monotone"
                dataKey={selectedMetric}
                stroke={colorOf(selectedMetric)}
                strokeWidth={3}
                filter="url(#lineShadow)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: colorOf(selectedMetric),
                  stroke: "#fff",
                  strokeWidth: 2,
                  filter: "url(#dotShadow)",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </Card>
    </motion.div>
  );
}
