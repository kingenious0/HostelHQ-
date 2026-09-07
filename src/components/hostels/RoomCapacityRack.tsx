"use client";

import * as React from "react";
import { RoomTypeInventorySummary, PhysicalRoomState } from "@/lib/room-capacity";
import { Badge } from "@/components/ui/badge";
import { Users, DoorOpen, Bed, UserCheck, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomCapacityRackProps {
  summary: RoomTypeInventorySummary;
  selectedRoomNumber?: string;
  onSelectRoom?: (room: PhysicalRoomState) => void;
  interactive?: boolean;
}

export function RoomCapacityRack({
  summary,
  selectedRoomNumber,
  onSelectRoom,
  interactive = false,
}: RoomCapacityRackProps) {
  const isSoldOut = summary.isSoldOut || summary.totalAvailableBeds === 0;
  const percentOccupied = isSoldOut
    ? 100
    : summary.totalBeds > 0
    ? Math.round((summary.totalOccupiedBeds / summary.totalBeds) * 100)
    : 0;

  return (
    <div className={cn(
      "space-y-3.5 p-4 rounded-2xl border transition-all",
      isSoldOut
        ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
        : "bg-slate-50/80 dark:bg-slate-900/40 border-border/60"
    )}>
      {/* Top Headline & Summary Stat */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div>
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Bed className="h-4 w-4 text-primary"/>
            Live Bed & Room Vacancy
          </span>
          <p className="text-[11px] text-muted-foreground">
            {isSoldOut ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                100% capacity reached • 0 of {summary.totalBeds} beds available
              </span>
            ) : (
              `${summary.totalAvailableBeds} of ${summary.totalBeds} total beds open across ${summary.totalRooms} rooms`
            )}
          </p>
        </div>

        {/* Dynamic Status Tag */}
        <div className="flex items-center gap-1.5">
          {isSoldOut ? (
            <Badge className="bg-rose-600 hover:bg-rose-600 text-white border-0 text-[10px] font-black flex items-center gap-1 uppercase tracking-wider" variant="destructive">
              <Lock className="h-3 w-3" />
              Sold Out (100% Full)
            </Badge>
          ) : summary.partialRoomsCount > 0 ? (
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
              ⚡ {summary.partialRoomsCount} Room with 1 Spot Left
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
              ✓ All {summary.totalRooms} Rooms Open
            </Badge>
          )}
        </div>
      </div>

      {/* Segmented Progress Bar (Mercury Design, Attached Image 3) */}
      <div className="space-y-1">
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 flex overflow-hidden">
          <div
            style={{ width: `${percentOccupied}%` }}
            className={cn(
              "h-full transition-all duration-500",
              isSoldOut || percentOccupied >= 90 ? "bg-rose-500" : percentOccupied > 50 ? "bg-amber-500" : "bg-primary"
            )}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-0.5">
          <span>{isSoldOut ? summary.totalBeds : summary.totalOccupiedBeds} Taken</span>
          <span>{isSoldOut ? "0" : summary.totalAvailableBeds} Beds Vacant</span>
        </div>
      </div>

      {/* Individual Room Grid Rack (Linktree Day Pills, Attached Image 4) */}
      <div className="pt-1">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
          {isSoldOut ? "Room Inventory (Sold Out • Read-Only):" : interactive ? "Select an available room to secure:" : "Room-by-Room Availability:"}
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {summary.rooms.map((room) => {
            const isSelected = selectedRoomNumber === room.roomNumber;
            const isFull = room.status === "full";

            return (
              <button
                key={room.roomNumber}
                type="button"
                disabled={!interactive || isFull}
                onClick={() => interactive && !isFull && onSelectRoom?.(room)}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all flex items-center justify-between",
                  isFull
                    ? "bg-slate-100/60 dark:bg-slate-900/20 border-border/40 opacity-60 cursor-not-allowed"
                    : isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-xs"
                    : interactive
                    ? "border-border/80 bg-background hover:border-primary/50 hover:bg-primary/[0.02] cursor-pointer shadow-2xs"
                    : "border-border/60 bg-background"
                )}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      {room.roomNumber}
                    </span>
                    {/* Status Dot */}
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        room.status === "empty"
                          ? "bg-emerald-500"
                          : room.status === "partial"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-rose-500"
                      )}
                    />
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {room.status === "empty" && `Empty • ${room.capacity} beds open`}
                    {room.status === "partial" && `${room.spotsLeft} spot left • 1 roommate`}
                    {room.status === "full" && "Full • 0 beds left"}
                  </p>
                </div>

                {/* Micro Bed Silhouettes */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: room.capacity }).map((_, bIdx) => (
                    <span
                      key={bIdx}
                      className={cn(
                        "h-4 w-4 rounded-md flex items-center justify-center text-[9px] font-bold border",
                        bIdx < room.occupancy
                          ? "bg-slate-800 text-white border-slate-900 dark:bg-slate-200 dark:text-slate-900"
                          : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
                      )}
                    >
                      {bIdx < room.occupancy ? "●" : "○"}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
