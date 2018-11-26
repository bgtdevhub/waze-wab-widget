import declare from 'dojo/_base/declare';
import BaseWidget from 'jimu/BaseWidget';
import FeatureLayer from 'esri/layers/FeatureLayer';
import Query from 'esri/tasks/query';
import PictureMarkerSymbol from 'esri/symbols/PictureMarkerSymbol';

// To create a widget, you need to derive from BaseWidget.
export default declare([BaseWidget], {
  // Custom widget code goes here

  baseClass: 'waze-alerts',

  alertTypesModel: [
    {
      type: 'WEATHERHAZARD',
      active: true,
      count: 0
    },
    {
      type: 'ROAD_CLOSED',
      active: true,
      count: 0
    },
    {
      type: 'JAM',
      active: true,
      count: 0
    },
    {
      type: 'ACCIDENT',
      active: true,
      count: 0
    }
  ],

  timeModel: [
    {
      quarter: 1,
      pubMillis: 0,
      datetime: ''
    },
    {
      quarter: 2,
      pubMillis: 0,
      datetime: ''
    },
    {
      quarter: 3,
      pubMillis: 0,
      datetime: ''
    },
    {
      quarter: 4,
      pubMillis: 0,
      datetime: ''
    }
  ],

  currentTimeFilter: {
    quarter: 1,
    pubMillis: 0,
    datetime: ''
  },

  isQueryInProgress: true,

  postCreate() {
    this.inherited(arguments);

    this.timeModel = this.setTimeModel(this.timeModel);

    this.currentTimeFilter = this.timeModel[0];

    if (this.config.hasCustomLayer) {
      this.alertLayer = this.map.getLayer(this.config.customMapLayer);

      try {
        this.updateDefinitionExpression();

        this.setLoading(false);
      } catch (err) {
        alert(
          'Layer defined is not a valid Waze data layer. Widget will not work as expected.'
        );
      }
    } else {
      const featureServerUrl = this.config.featureServerUrl;
      const layerOptions = {
        outFields: ['*'],
        visible: false
      };

      this.alertLayer = new FeatureLayer(featureServerUrl + '/0', layerOptions);

      this.updateDefinitionExpression();

      this.map.addLayer(this.alertLayer);
    }

    this.refreshInterval(this.config.refreshInterval);
  },

  updateDataModel() {
    const query = new Query();

    query.where = this.getDefinitionExpression();
    query.outFields = ['*'];

    this.setLoading(true);

    this.alertLayer.queryFeatures(query).then(({ features }) => {
      this.setLoading(false);

      this.addSymbolsToMap(features);

      this.updateAlertCount(features);

      this.updateAlertCountView(this.alertTypesModel);

      if (this.currentTimeFilter.pubMillis === 0) {
        this.currentTimeFilter = this.timeModel[0];
      }
    });
  },

  setTimeModel(timeModel) {
    const currentTimeInSeconds = new Date().getTime() / 1000;
    //period of data queried (i.e 86400 is 24 hours worth of data)
    const dataPeriod = this.config.dataPeriod;
    const timeRange = {
      start: currentTimeInSeconds - dataPeriod,
      end: currentTimeInSeconds
    };

    const timeRangeDivider = (timeRange.end - timeRange.start) / 4;

    return timeModel.map(x => {
      x.pubMillis = Math.floor(
        timeRange.start + timeRangeDivider * (x.quarter - 1)
      );

      x.datetime = new Date(x.pubMillis * 1000)
        .toLocaleString()
        .replace(',', '');

      return x;
    });
  },

  updateAlertCount(features) {
    const updateCountModel = (type, model) => ({
      count: (model.find(x => x.type === type).count += 1)
    });

    this.alertTypesModel = this.alertTypesModel.map(x => ({
      ...x,
      ...{ count: 0 }
    }));

    features.forEach(x => {
      this.alertTypesModel = [
        ...this.alertTypesModel,
        ...updateCountModel(x.attributes.type, this.alertTypesModel)
      ];
    });
  },

  updateAlertCountView(model) {
    model.forEach(({ type, count }) => {
      const counter = document.getElementById(type + '_alert_count');

      counter.innerHTML = count;
    });
  },

  refreshInterval(interval) {
    setTimeout(() => {
      this.updateDefinitionExpression();
    }, interval);
  },

  addSymbolsToMap(features) {
    this.map.graphics.clear();

    features.forEach(x => {
      x.show();

      x.setSymbol(this.generateSymbol(x.attributes.type));

      this.map.graphics.add(x);
    });
  },

  generateSymbol(type) {
    const iconFileName = {
      WEATHERHAZARD: 'hazard',
      ROAD_CLOSED: 'construction',
      JAM: 'traffic',
      ACCIDENT: 'accident'
    };

    const iconSize = 40;

    const symbolOptions = {
      url: `${this.config.imagePath}/pins/${iconFileName[type] ||
        iconFileName.WEATHERHAZARD}.png`,
      width: iconSize,
      height: iconSize
    };

    return (symbol = new PictureMarkerSymbol(symbolOptions));
  },

  getDefinitionExpression() {
    const getActiveAlertTypes = model =>
      model
        .filter(x => !!x.active)
        .map(({ type }) => `type = '${type}'`)
        .join(' or ');

    const alertQuery = getActiveAlertTypes(this.alertTypesModel);

    const { pubMillis } = this.currentTimeFilter;
    const pubMillisQuery = pubMillis >= 0 ? `pubMillis >= ${pubMillis}` : '';

    if (alertQuery !== '' && pubMillisQuery !== '') {
      return `(${alertQuery}) and ${pubMillisQuery}`;
    }

    return alertQuery === '' ? pubMillisQuery : alertQuery;
  },

  updateDefinitionExpression() {
    this.alertLayer.setDefinitionExpression(this.getDefinitionExpression());

    if (this.config.hasCustomLayer) return;

    this.updateDataModel();
  },

  _toggleAlerts(e) {
    const { alertType } = e.target.dataset;
    const activeAlerts = this.alertTypesModel.filter(x => x.active);

    if (
      this.isQueryInProgress ||
      (activeAlerts.length <= 1 && activeAlerts[0].type === alertType)
    ) {
      e.preventDefault();
      return;
    }

    this.alertTypesModel = this.alertTypesModel.map(x => {
      if (x.type !== alertType) return x;
      x.active = !x.active;
      return x;
    });

    this.updateButtonsView();

    this.updateDefinitionExpression();
  },

  updateButtonsView() {
    const buttons = document.querySelectorAll('.waze-alerts-button');

    if (!buttons.length) return;

    const activeClass = 'active';

    buttons.forEach(x => {
      const isActive = this.alertTypesModel.find(
        t => t.type === x.dataset.alertType
      ).active;

      if (isActive) {
        x.classList.add(activeClass);
      } else {
        x.classList.remove(activeClass);
      }
    });
  },

  updateTimeFilterView() {
    const dateEl = document.querySelectorAll('.waze-alerts-time-date');

    dateEl.forEach((x, i) => {
      const timeStrArr = this.timeModel
        .find(x => x.quarter === i + 1)
        .datetime.split(' ');

      x.innerHTML = timeStrArr[0] + '<br />' + timeStrArr[1] + timeStrArr[2];
    });
  },

  setLoading(isLoad) {
    this.isQueryInProgress = isLoad;
    this.updateLoadView();
  },

  updateLoadView() {
    const el = document.querySelector('.waze-alerts');
    const loadingClass = 'waze-alerts-loading';

    if (!el) return;

    if (this.isQueryInProgress) {
      el.classList.add(loadingClass);
    } else {
      el.classList.remove(loadingClass);
    }
  },

  _filterByPeriod(e) {
    if (this.isQueryInProgress) {
      e.preventDefault();
      return;
    }

    this.currentTimeFilter = this.timeModel.find(
      x => x.quarter == e.target.value
    );

    this.updateDefinitionExpression();
  },

  onOpen() {
    this.updateButtonsView();
    this.updateTimeFilterView();
    this.updateLoadView();
  }
});
