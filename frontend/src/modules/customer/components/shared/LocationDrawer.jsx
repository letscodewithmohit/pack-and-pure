import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Search, MapPin, Plus, Home, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../../context/LocationContext";

const LocationDrawer = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const {
    currentLocation,
    savedAddresses,
    updateLocation,
    refreshLocation,
    isFetchingLocation,
    locationError,
  } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Close drawer when location is successfully fetched
  const prevFetching = React.useRef(isFetchingLocation);
  React.useEffect(() => {
    if (prevFetching.current && !isFetchingLocation && !locationError) {
      onClose();
    }
    prevFetching.current = isFetchingLocation;
  }, [isFetchingLocation, locationError, onClose]);

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight =
        "var(--removed-body-scroll-bar-size, 0px)"; // Prevent layout shift if possible
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  const handleSelectCurrentLocation = (e) => {
    e.preventDefault();
    e.stopPropagation();
    refreshLocation();
    // Keep drawer open so user sees "Detecting..."
  };

  const handleSelectAddress = (address) => {
    const newLoc = {
      name: address.address,
      time: "12-15 mins",
    };
    updateLocation(newLoc);
    onClose();
  };

  const handleAddAddress = () => {
    onClose();
    navigate("/addresses?add=1");
  };

  // Filter saved addresses
  const filteredAddresses = savedAddresses.filter(
    (addr) =>
      addr.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      addr.address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[600]"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            data-lenis-prevent
            style={{ overscrollBehavior: "contain" }}
            className="fixed bottom-0 left-0 right-0 bg-[#F3F4F6] rounded-t-[32px] z-[610] max-h-[90vh] overflow-y-auto outline-none shadow-2xl pb-8">
            {/* Header */}
            <div className="sticky top-0 bg-[#F3F4F6] px-6 pt-6 pb-4 flex flex-col gap-4 z-20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-[#1A1A1A]">
                  Select delivery location
                </h2>
                <button
                  onClick={onClose}
                  className="h-10 w-10 bg-black/5 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors">
                  <X size={20} className="text-[#1A1A1A]" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Search
                    size={20}
                    className="text-[#1A1A1A]/40 group-focus-within:text-[#0c831f] transition-colors"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Search for area, street name.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold placeholder:text-[#1A1A1A]/40 shadow-sm focus:ring-2 focus:ring-[#0c831f]/20 transition-all outline-none"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="px-4 flex flex-col gap-3">
              {/* Current Location - single onClick to avoid duplicate API calls (was 2x from onPointerDown + onClick) */}
              <button
                type="button"
                data-lenis-prevent
                data-lenis-prevent-touch
                onClick={handleSelectCurrentLocation}
                className="flex items-center gap-4 bg-white p-4 rounded-2xl hover:bg-slate-50 transition-colors group text-left shadow-sm w-full">
                <div className="h-10 w-10 flex items-center justify-center text-[#0c831f]">
                  <MapPin
                    size={24}
                    className="group-hover:scale-110 transition-transform"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#0c831f] text-[15px]">
                    {isFetchingLocation
                      ? "Detecting your location..."
                      : "Use your current location"}
                  </h3>
                  <p className="text-[13px] text-slate-500 font-medium">
                    {currentLocation.name}
                  </p>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </button>

              {/* Add Address */}
              <button
                onClick={handleAddAddress}
                className="flex items-center gap-4 bg-white p-4 rounded-2xl hover:bg-slate-50 transition-colors group text-left shadow-sm">
                <div className="h-10 w-10 flex items-center justify-center text-[#0c831f]">
                  <Plus
                    size={24}
                    className="group-hover:rotate-90 transition-transform"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#0c831f] text-[15px]">
                    Add new address
                  </h3>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </button>

              {/* Saved Addresses Section */}
              <div className="mt-4 px-2">
                <h4 className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                  Your saved addresses
                </h4>

                <div className="flex flex-col gap-4">
                  {filteredAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => handleSelectAddress(addr)}
                      className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-yellow-500 flex-shrink-0">
                          {addr.label === "Home" ? (
                            <Home
                              size={26}
                              fill="currentColor"
                              className="opacity-80"
                            />
                          ) : (
                            <MapPin
                              size={26}
                              fill="currentColor"
                              className="opacity-80"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-[#1A1A1A] text-lg">
                              {addr.label}
                            </h3>
                            {(addr.address === currentLocation.name ||
                              addr.isCurrent) && (
                              <span className="text-[10px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight border border-teal-100">
                                You are here
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] text-slate-500 font-medium leading-relaxed mb-3">
                            {addr.address}
                          </p>
                          <p className="text-[12px] text-slate-400 font-bold">
                            Phone number: {addr.phone}
                          </p>
                        </div>
                      </div>

                      {/* Selection Glow */}
                      {(addr.address === currentLocation.name ||
                        addr.isCurrent) && (
                        <div className="absolute top-0 right-0 h-1 w-24 bg-gradient-to-l from-[#0c831f] to-transparent opacity-50" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LocationDrawer;
