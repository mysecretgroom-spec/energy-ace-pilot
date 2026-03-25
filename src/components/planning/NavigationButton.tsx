import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Navigation, Map, MapPin } from "lucide-react";

interface NavigationButtonProps {
  address: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  className?: string;
  size?: "default" | "sm";
}

export function NavigationButton({ address, city, postalCode, latitude, longitude, className, size = "default" }: NavigationButtonProps) {
  const fullAddress = [address, postalCode, city].filter(Boolean).join(",");
  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const encodedAddress = encodeURIComponent(fullAddress);

  const openWaze = () => {
    if (latitude && longitude) {
      // Use both coordinates AND address for accuracy
      window.open(`https://waze.com/ul?ll=${latitude},${longitude}&q=${encodedAddress}&navigate=yes`, "_blank");
    } else {
      window.open(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`, "_blank");
    }
  };

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
  };

  const openAppleMaps = () => {
    window.open(`https://maps.apple.com/?q=${encodedAddress}`, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className={`${sizeClasses} rounded-full bg-gradient-hero ${className}`}
        >
          <Navigation className={iconSize} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={openWaze} className="gap-2 cursor-pointer">
          <Navigation className="h-4 w-4 text-[#33ccff]" />
          Waze
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openGoogleMaps} className="gap-2 cursor-pointer">
          <Map className="h-4 w-4 text-[#4285f4]" />
          Google Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openAppleMaps} className="gap-2 cursor-pointer">
          <MapPin className="h-4 w-4 text-[#007aff]" />
          Plans (Apple)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
