import declare from 'dojo/_base/declare';
import BaseWidgetSetting from 'jimu/BaseWidgetSetting';
import on from 'dojo/on';

export default declare([BaseWidgetSetting], {
  baseClass: 'waze-alerts-setting',

  postCreate() {
    // the config object is passed in
    this.setConfig(this.config);

    this.map.graphicsLayerIds.forEach(x => {
      const el = document.createElement('option');

      el.text = el.value = x;

      this.layer.appendChild(el);
    });

    const onCheck = e => {
      const { checked } = e.target;
      const hiddenClass = 'hidden';

      if (checked) {
        this.layersContainer.classList.remove(hiddenClass);
      } else {
        this.layersContainer.classList.add(hiddenClass);
      }
    };

    this.own(on(this.hasCustomLayer, 'change', onCheck));
  },

  setConfig(config) {
    this.layer.value = config.customMapLayer;

    const hiddenClass = 'hidden';

    if (config.hasCustomLayer) {
      this.layersContainer.classList.remove(hiddenClass);
      this.hasCustomLayer.checked = true;
    }
  },

  getConfig() {
    // WAB will get config object through this method
    return {
      hasCustomLayer: this.hasCustomLayer.checked || false,
      customMapLayer: this.layer.value || '',
      imagePath: this.config.imagePath || 'widgets/WazeAlerts/images',
      dataPeriod: this.config.dataPeriod || 86400,
      featureServerUrl:
        this.config.featureServerUrl ||
        'https://services9.arcgis.com/hbNUXYa0vWyWMkdB/ArcGIS/rest/services/Waze_Alerts_and_Traffic/FeatureServer',
      refreshInterval: this.config.refreshInterval || 300000
    };
  }
});
