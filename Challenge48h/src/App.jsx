import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import Fuse from 'fuse.js';

const App = () => {
  const [bikeStations, setBikeStations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Lille');
  const [userLocation, setUserLocation] = useState(null);
  const [closestStations, setClosestStations] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    axios.get('https://data.lillemetropole.fr/geoserver/wfs?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=dsp_ilevia%3Avlille_temps_reel&OUTPUTFORMAT=json')
      .then((response) => {
        setBikeStations(response.data.features);
      })
      .catch((error) => {
        console.error("Erreur de récupération des données", error);
      });
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);

        if (!mapRef.current) {
          mapRef.current = L.map('map').setView([latitude, longitude], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
        }

        const userIcon = L.divIcon({
          className: 'custom-icon',
          html: `<div style="background-color: blue; width: 20px; height: 20px; border-radius: 50%;"></div>`
        });

        L.marker([latitude, longitude], { icon: userIcon })
          .addTo(mapRef.current)
          .bindPopup('Vous êtes ici');
      }, () => {
        if (!mapRef.current) {
          mapRef.current = L.map('map').setView([50.62925, 3.057256], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      bikeStations.forEach((station) => {
        const coordinates = station.geometry.coordinates;
        const name = station.properties.nom;
        const availableBikes = station.properties.nb_velos_dispo;

        if (coordinates && coordinates.length === 2) {
          const [lon, lat] = coordinates;
          if (!isNaN(lon) && !isNaN(lat)) {
            const icon = L.divIcon({
              className: 'custom-icon',
              html: `<div style="background-color: ${availableBikes === 0 ? 'red' : 'green'}; width: 20px; height: 20px; border-radius: 50%;"></div>`
            });

            L.marker([lat, lon], { icon })
              .addTo(mapRef.current)
              .bindPopup(`
                <b>${name ? name : 'Station sans nom'}</b><br>
                Vélo disponible : ${availableBikes !== undefined ? availableBikes : 'Données non disponibles'}
              `);
          }
        }
      });
    }
  }, [bikeStations]);

  useEffect(() => {
    if (userLocation && bikeStations.length > 0) {
      const distances = bikeStations.map(station => {
        const [lon, lat] = station.geometry.coordinates;
        const distance = Math.sqrt(Math.pow(userLocation[0] - lat, 2) + Math.pow(userLocation[1] - lon, 2));
        return { ...station, distance };
      });

      distances.sort((a, b) => a.distance - b.distance);
      setClosestStations(distances.slice(0, 3));
    }
  }, [userLocation, bikeStations]);

  useEffect(() => {
    axios.get('https://data.lillemetropole.fr/geoserver/ows?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=mel_mobilite_et_transport%3Asc_schema_cyclable_pm35_2023&OUTPUTFORMAT=json')
      .then((response) => {
        const cyclePaths = response.data.features;
        cyclePaths.forEach((path) => {
          const coordinates = path.geometry.coordinates;
          const latlngs = coordinates.map(coord => [coord[1], coord[0]]);
          L.polyline(latlngs, { color: 'blue' }).addTo(mapRef.current);
        });
      })
      .catch((error) => {
        console.error("Erreur de récupération des données de pistes cyclables", error);
      });
  }, []);

  const handleSearch = async () => {
    if (searchQuery) {
      try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery},${selectedCity}&bounded=1&viewbox=2.9,50.5,3.3,50.8`);
        
        if (response.data.length > 0) {
          const { lat, lon } = response.data[0];
          mapRef.current.setView([lat, lon], 15);

          // Utilisation de Fuse.js pour gérer les fautes de frappe
          const fuse = new Fuse(bikeStations, {
            keys: ["properties.nom"],
            threshold: 0.3, // Tolérance des fautes
          });

          const fuzzyResults = fuse.search(searchQuery);
          const filteredStations = fuzzyResults.map(result => result.item);

          let nearestStation = null;
          let minDistance = Infinity;

          filteredStations.forEach((station) => {
            const [stationLon, stationLat] = station.geometry.coordinates;
            const distance = Math.sqrt(Math.pow(lat - stationLat, 2) + Math.pow(lon - stationLon, 2));
            if (distance < minDistance) {
              minDistance = distance;
              nearestStation = station;
            }
          });

          if (nearestStation) {
            const [nearestLon, nearestLat] = nearestStation.geometry.coordinates;
            const name = nearestStation.properties.nom;
            const availableBikes = nearestStation.properties.nb_velos_dispo;

            const popupContent = `
              <b>${name ? name : 'Station sans nom'}</b><br>
              Vélo disponible : ${availableBikes !== undefined ? availableBikes : 'Données non disponibles'}
            `;

            L.popup()
              .setLatLng([nearestLat, nearestLon])
              .setContent(popupContent)
              .openOn(mapRef.current);
          }
        } else {
          alert('Rue non trouvée ou en dehors de la métropole lilloise');
        }
      } catch (error) {
        console.error("Erreur de recherche de la rue", error);
      }
    }
  };

  return (
    <div>
      <header>
        <img src="src/components/logo-mel.jpg" alt="Logo MEL" className="logomel" />
      </header>
      <div className="search-bar">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une rue"
        />
        <select className='citybutton' value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
          <option value="Lille">Lille</option>
          <option value="Roubaix">Roubaix</option>
          <option value="Tourcoing">Tourcoing</option>
          <option value="Villeneuve-d'Ascq">Villeneuve-d'Ascq</option>
          <option value="Marcq-en-Baroeul">Marcq-en-Baroeul</option>
          <option value="Mons-en-Baroeul">Mons-en-Baroeul</option>
          <option value="Wattrelos">Wattrelos</option>
          <option value="Loos">Loos</option>
          <option value="Lambersart">Lambersart</option>
          <option value="La Madeleine">La Madeleine</option>
          <option value="Saint-André-lez-Lille">Saint-André-lez-Lille</option>
          <option value="Faches-Thumesnil">Faches-Thumesnil</option>
          <option value="Ronchin">Ronchin</option>
          <option value="Hem">Hem</option>
          <option value="Croix">Croix</option>
          <option value="Wasquehal">Wasquehal</option>
          <option value="Mouvaux">Mouvaux</option>
          <option value="Seclin">Seclin</option>
          <option value="Halluin">Halluin</option>
          <option value="Haubourdin">Haubourdin</option>
        </select>
        <button onClick={handleSearch}>Rechercher</button>
      </div>
      <div id="map" style={{ width: '100%', height: '500px' }}></div>
      <div className="titretexte">
        <h2>Informations disponibles</h2>
      </div>
      <div className="cartes-stations">
        {closestStations.map((station, index) => (
          <div key={index} className="station1">
            <h3 className="station">{station.properties.nom}</h3>
            <p className="restants">{station.properties.nb_velos_dispo} v'lille restants</p>
            <p className="distance">Distance: {station.distance.toFixed(2)} km</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
