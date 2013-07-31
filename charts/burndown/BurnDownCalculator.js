(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("Rally.apps.charts.burndown.BurnDownCalculator", {
        extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

        mixins: [
            "Rally.apps.charts.DateMixin"
        ],

        getDerivedFieldsOnInput: function () {
            var completedStates = this.config.completedScheduleStateNames,
                aggregationType = this.config.chartAggregationType;

            return [
                {
                    "as": "RemainingPoints",
                    "f": function (snapshot) {
                        var ss = snapshot.ScheduleState;
                        if(completedStates.indexOf(ss) < 0 && snapshot.PlanEstimate) {
                            if(aggregationType === "storycount") {
                                return 1;
                            } else {
                                return snapshot.PlanEstimate;
                            }
                        }

                        return 0;
                    }
                },
                {
                    "as": "AcceptedPoints",
                    "f": function (snapshot) {
                        var ss = snapshot.ScheduleState;
                        if (completedStates.indexOf(ss) > -1 && snapshot.PlanEstimate) {
                            if (aggregationType === "storycount") {
                                return 1;
                            } else {
                                return snapshot.PlanEstimate;
                            }
                        }

                        return 0;
                    }
                }
            ];
        },

        getMetrics: function () {
            return [
                {
                    "field": "RemainingPoints",
                    "as": "To Do",
                    "f": "sum"
                },
                {
                    "field": "AcceptedPoints",
                    "as": "Accepted",
                    "f": "sum"
                }
            ];
        },

        getSummaryMetricsConfig: function () {
            return [
                {
                    'as': 'Scope_max',
                    'f': function(seriesData) {
                            var max = 0, i = 0;
                            for (i=0;i<seriesData.length;i++) {
                                if(seriesData[i].Accepted + seriesData[i]['To Do'] > max) {
                                    max = seriesData[i].Accepted + seriesData[i]['To Do'];
                                }
                            }
                            return max;
                         }
                }
            ];
        },

        getDerivedFieldsAfterSummary: function () {
            return  [
                {
                    "as": "Ideal",
                    "f": function (row, index, summaryMetrics, seriesData) {
                        var max = summaryMetrics.Scope_max,
                            increments = seriesData.length - 1,
                            incrementAmount = max / increments;
                        return Math.floor(100 * (max - index * incrementAmount)) / 100;
                    },
                    "display": "line"
                },
                {
                    "as": "Prediction",
                    "f": function (row, index, summaryMetrics, seriesData) {
                        return null;
                    },
                    "display": "line",
                    "dashStyle": "Dash"
                }
            ];
        },

        getProjectionsConfig: function () {
            return {
                series: [
                    {
                        "as": "Prediction",
                        "field": "To Do"
                    }
                ],
                continueWhile: function (point) {
                    return point.Prediction > 0;
                }
            };
        },

        runCalculation: function (snapshots) {
            var chartData = this.callParent(arguments),
                todayIndex;

            todayIndex = this._indexOfToday(chartData);

            if(todayIndex > 0) {
                this._removeFutureSeries(chartData, 0, todayIndex);
                this._removeFutureSeries(chartData, 1, todayIndex);
            }

            if (this.enableProjections && this._projectionsSlopePositive(chartData)) {
                this._removeProjectionSeries(chartData);
            }

            return chartData;
        },

        _indexOfToday: function(chartdata) {
             var today = Ext.Date.format(new Date(), 'Y-m-d'),
                 index = chartData.categories.indexOf(today);
             return index;
        },

        _removeFutureSeries: function (chartData, seriesIndex, dayIndex) {
            if(chartData.series[seriesIndex].data.length > dayIndex) {
                while(++dayIndex < chartData.series[seriesIndex].data.length) {
                    chartData.series[seriesIndex].data[dayIndex] = null;
                }
            }
        },

        _projectionsSlopePositive: function (chartData) {
            if(chartData.projections && chartData.projections.series) {
                return chartData.projections.series[0].slope >= 0;
            }

            return true;
        },

        _removeProjectionSeries: function (chartData) {
            var series = chartData.series,
                categories = chartData.categories;

            var endDate = this.endDate.split("T")[0],
                endDateIndex = categories.indexOf(endDate);

            _.each(series, function (seriesData) {
                seriesData.data = _.first(seriesData.data, endDateIndex + 1);
            });

            chartData.series = _.filter(series, function (seriesData) {
                return seriesData.name != "Prediction";
            });

            chartData.categories = _.first(categories, endDateIndex + 1);
        }
    });
}());
