// src/components/map/TaskPriceMarker.jsx
import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

const getCategoryColor = (category) => {
  switch (category) {
    case 'XEROX_PICKUP':
      return '#4f46e5'; // Indigo
    case 'BUY_ITEMS':
      return '#059669'; // Emerald
    case 'CARRY_THINGS':
      return '#d97706'; // Amber
    case 'QUEUE':
      return '#7c3aed'; // Violet
    default:
      return '#334155'; // Slate
  }
};

export const createTaskPriceIcon = (price, category) => {
  const bg = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-task-price-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        <div style="background-color: ${bg}; color: white; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 9999px; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
          <span>₹${Math.round(price)}</span>
        </div>
        <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${bg}; margin-top: -1px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export function TaskPriceMarker({ task, userRole = 'WORKER' }) {
  const navigate = useNavigate();

  // Coordinates can be direct properties or in PostGIS GeoJSON location
  let lat = task.latitude ?? task.lat;
  let lng = task.longitude ?? task.lng;

  if ((lat === undefined || lng === undefined) && task.location?.coordinates) {
    lng = task.location.coordinates[0];
    lat = task.location.coordinates[1];
  }

  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return null;
  }

  const price = task.budget || task.agreed_price || 0;
  const icon = createTaskPriceIcon(price, task.category);

  const handleOpenDetail = () => {
    const route = userRole === 'REQUESTER' ? `/requester/tasks/${task.id}` : `/worker/tasks/${task.id}`;
    navigate(route);
  };

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup>
        <div className="p-1 min-w-[190px]">
          <span className="text-[10px] uppercase font-bold text-brand-600 tracking-wider">
            {task.category?.replace(/_/g, ' ')}
          </span>
          <h4 className="font-bold text-slate-900 text-xs mt-0.5">{task.title}</h4>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {task.address || task.description || 'Campus chore'}
          </p>
          <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100">
            <span className="font-extrabold text-slate-900 text-xs">₹{price}</span>
            <button
              onClick={handleOpenDetail}
              className="text-[11px] bg-brand-600 hover:bg-brand-700 text-white font-semibold px-2.5 py-1 rounded transition-colors"
            >
              View Task
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default TaskPriceMarker;
