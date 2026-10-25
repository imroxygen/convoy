import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, Sun, Moon, MapPin, Loader2, History, Compass, ChevronRight } from 'lucide-react';
import {
  type SearchResultItem,
  QUICK_CATEGORIES,
  POPULAR_ROAD_TRIPS,
} from '../utils/searchService';
import { computeDistanceKm } from '../utils/geo';

interface GoogleSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResultItem[];
  isSearching: boolean;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  onSearch: (query: string) => void;
  onSelectResult: (item: SearchResultItem) => void;
  onOpenJoinModal: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentCoords?: { lat: number; lon: number } | null;
}

export const GoogleSearchBar: React.FC<GoogleSearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  isSearchFocused,
  setIsSearchFocused,
  onSearch,
  onSelectResult,
  onOpenJoinModal,
  theme,
  onToggleTheme,
  currentCoords,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<SearchResultItem[]>(() => {
    try {
      const saved = localStorage.getItem('convoy_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [setIsSearchFocused]);

  // Reset keyboard active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults]);

  const saveRecentSearch = (item: SearchResultItem) => {
    try {
      const updated = [item, ...recentSearches.filter((r) => r.id !== item.id)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('convoy_recent_searches', JSON.stringify(updated));
    } catch (e) {}
  };

  const removeRecentSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter((r) => r.id !== id);
    setRecentSearches(updated);
    try {
      localStorage.setItem('convoy_recent_searches', JSON.stringify(updated));
    } catch (err) {}
  };

  const clearAllRecents = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('convoy_recent_searches');
    } catch (err) {}
  };

  const handleItemSelect = (item: SearchResultItem) => {
    saveRecentSearch(item);
    setIsSearchFocused(false);
    onSelectResult(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeIndex >= 0 ? searchResults[activeIndex] : searchResults[0];
      if (target) {
        handleItemSelect(target);
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
    }
  };

  // Helper to highlight matching characters in name
  const renderHighlightedName = (name: string, query: string) => {
    if (!query.trim()) return name;
    const q = query.trim().toLowerCase();
    const idx = name.toLowerCase().indexOf(q);
    if (idx === -1) return name;

    const before = name.substring(0, idx);
    const match = name.substring(idx, idx + q.length);
    const after = name.substring(idx + q.length);

    return (
      <>
        {before}
        <span className="search-match-highlight">{match}</span>
        {after}
      </>
    );
  };

  const isQueryMode = searchQuery.trim().length > 0;

  return (
    <div className="top-map-bar-container" ref={searchContainerRef}>
      {/* Google Maps / Apple Style Frosted Capsule Bar */}
      <div className={`apple-glass-search-box ${isSearchFocused ? 'focused' : ''}`}>
        <div className="apple-search-icon">
          {isSearching ? (
            <Loader2 size={18} className="spin-animate" color="var(--primary)" />
          ) : (
            <Search size={18} />
          )}
        </div>

        <input
          type="text"
          className="apple-search-input"
          placeholder="Search destination, city, cafe, fuel..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />

        {searchQuery && (
          <button
            type="button"
            className="apple-clear-btn"
            onClick={() => {
              setSearchQuery('');
              onSearch('');
            }}
            title="Clear Search"
          >
            <X size={15} />
          </button>
        )}

        <div className="apple-bar-divider" />

        <button
          type="button"
          className="apple-pill-btn"
          onClick={onOpenJoinModal}
          title="Join Squad Convoy with Room Code"
        >
          <Users size={14} />
          <span>Join</span>
        </button>

        <button
          type="button"
          className="apple-circle-action-btn"
          onClick={onToggleTheme}
          title="Toggle Dark / Light Mode"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Enhanced Google Autocomplete & Discovery Dropdown */}
        {isSearchFocused && (
          <div className="apple-autocomplete-dropdown">
            {/* Quick Category Discovery Bar (Google Maps style) */}
            <div className="google-category-chips-row">
              {QUICK_CATEGORIES.map((cat) => (
                <button
                  key={cat.query}
                  type="button"
                  className="google-cat-chip"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchQuery(cat.label);
                    onSearch(cat.query);
                  }}
                >
                  <span className="chip-icon">{cat.icon}</span>
                  <span className="chip-label">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* State A: User is typing an active query */}
            {isQueryMode ? (
              <>
                {searchResults.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`apple-autocomplete-item ${idx === activeIndex ? 'active' : ''}`}
                    onClick={() => handleItemSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <div className="apple-item-icon-circle">
                      <span>{item.categoryIcon}</span>
                    </div>

                    <div className="apple-item-text-group">
                      <div className="apple-item-top-row">
                        <span className="apple-place-name">
                          {renderHighlightedName(item.name, searchQuery)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="apple-category-badge">{item.categoryName}</span>
                          {item.distanceKm !== undefined && (
                            <span className="apple-distance-badge">
                              {item.distanceKm < 1 ? '< 1 km' : `${Math.round(item.distanceKm)} km`}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="apple-secondary-address">{item.secondaryText}</span>
                    </div>
                  </div>
                ))}

                {searchResults.length === 0 && !isSearching && (
                  <div className="apple-empty-result">
                    <span>No matching places found. Try a different city or drop a pin on the map.</span>
                  </div>
                )}
              </>
            ) : (
              /* State B: Zero-Query Discovery State (Recents + Popular Road Trips) */
              <>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="search-discovery-section">
                    <div className="search-section-header">
                      <span className="section-title">
                        <History size={13} /> Recent Searches
                      </span>
                      <button type="button" className="btn-clear-recents" onClick={clearAllRecents}>
                        Clear
                      </button>
                    </div>

                    {recentSearches.map((item) => (
                      <div
                        key={item.id}
                        className="apple-autocomplete-item recent-item"
                        onClick={() => handleItemSelect(item)}
                      >
                        <div className="apple-item-icon-circle recent">
                          <History size={16} />
                        </div>
                        <div className="apple-item-text-group">
                          <div className="apple-item-top-row">
                            <span className="apple-place-name">{item.name}</span>
                            {item.distanceKm !== undefined && (
                              <span className="apple-distance-badge">
                                {item.distanceKm < 1 ? '< 1 km' : `${Math.round(item.distanceKm)} km`}
                              </span>
                            )}
                          </div>
                          <span className="apple-secondary-address">{item.secondaryText}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-recent"
                          onClick={(e) => removeRecentSearch(e, item.id)}
                          title="Remove from recents"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Popular Road Trip Getaways */}
                <div className="search-discovery-section">
                  <div className="search-section-header">
                    <span className="section-title">
                      <Compass size={13} /> Popular Road Trip Squad Getaways
                    </span>
                  </div>

                  <div className="popular-getaways-grid">
                    {POPULAR_ROAD_TRIPS.map((trip) => {
                      const dist = currentCoords
                        ? Math.round(computeDistanceKm(currentCoords.lat, currentCoords.lon, trip.lat, trip.lon))
                        : null;

                      return (
                        <div
                          key={trip.name}
                          className="popular-trip-tile"
                          onClick={() => {
                            handleItemSelect({
                              id: `popular_${trip.name}`,
                              name: trip.name,
                              secondaryText: trip.secondary,
                              categoryIcon: trip.icon,
                              categoryName: trip.cat,
                              lat: trip.lat,
                              lon: trip.lon,
                              distanceKm: dist || 0,
                            });
                          }}
                        >
                          <div className="trip-tile-icon">{trip.icon}</div>
                          <div className="trip-tile-info">
                            <div className="trip-tile-title">
                              <span>{trip.name}</span>
                              {dist !== null && <span className="trip-tile-dist">{dist} km</span>}
                            </div>
                            <span className="trip-tile-sub">{trip.secondary}</span>
                          </div>
                          <ChevronRight size={14} className="trip-tile-arrow" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="apple-dropdown-footer">
              <MapPin size={13} />
              <span>Tip: Tap anywhere on the highway map to drop a direct pinpoint destination</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
