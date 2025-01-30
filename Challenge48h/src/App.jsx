import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';

const App = () => {
  const [bikeStations, setBikeStations] = useState([]);
  const mapRef = useRef(null); // Référence pour la carte

  useEffect(() => {
    // Récupérer les données des stations de vélo
    axios.get('https://data.lillemetropole.fr/geoserver/wfs?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=dsp_ilevia%3Avlille_temps_reel&OUTPUTFORMAT=json')
      .then((response) => {
        const stations = response.data.features;
        setBikeStations(stations);
      })
      .catch((error) => {
        console.error("Erreur de récupération des données", error);
      });
  }, []);

  useEffect(() => {
    // Initialiser la carte seulement si elle n'est pas déjà créée
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([50.62925, 3.057256], 13); // Position de Lille

      // Ajouter le fond de carte
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
    }

    // Ajouter les marqueurs après que les stations aient été chargées
    bikeStations.forEach((station) => {
      const coordinates = station.geometry.coordinates;
      if (coordinates && coordinates.length === 2) {
        const [lon, lat] = coordinates;
        if (!isNaN(lon) && !isNaN(lat)) {
          L.marker([lat, lon])
            .addTo(mapRef.current)
            .bindPopup(`<b>${station.properties.name}</b><br>Station vélo disponible`);
        }
      }
    });

  }, [bikeStations]);  // Se déclenche uniquement lorsqu'on a les données des stations

  return (
    <div>
      <h1>Carte des Stations de Vélo à Lille</h1>
      <div id="map" style={{ width: '100%', height: '500px' }}></div>
    </div>
  );
};

export default App;
