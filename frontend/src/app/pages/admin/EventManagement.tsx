import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Calendar, MapPin, User, DollarSign } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/StatusBadge";
import { getAdminEvents, type EventItem } from "../../services/events.service";

const EVENT_STATUSES = [
  "draft",
  "funding",
  "funded",
  "ticketing",
  "ongoing",
  "completed",
  "cancelled",
  "failed",
] as const;

export const EventManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getAdminEvents();
        setEvents(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load admin events",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        (event.title || "").toLowerCase().includes(q) ||
        (event.description || "").toLowerCase().includes(q) ||
        (event.venue?.address || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : (event.status || "").toLowerCase() === statusFilter;

      const matchesCategory =
        categoryFilter === "all"
          ? true
          : (event.category || "").toLowerCase() === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [events, searchQuery, statusFilter, categoryFilter]);

  const stats = [
    {
      label: "Total Events",
      value: events.length.toString(),
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "Draft",
      value: events.filter((e) => e.status === "draft").length.toString(),
      color: "from-slate-500 to-slate-400",
    },
    {
      label: "Funding",
      value: events.filter((e) => e.status === "funding").length.toString(),
      color: "from-yellow-500 to-orange-500",
    },
    {
      label: "Ongoing",
      value: events.filter((e) => e.status === "ongoing").length.toString(),
      color: "from-green-500 to-emerald-500",
    },
  ];

  if (loading) {
    return <div className="text-white">Loading events...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Event Management</h1>
        <p className="text-slate-400">Monitor and manage all platform events</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div
                className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-4`}
              >
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                {EVENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="music">Music</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="art">Art</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="conference">Conference</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">All Events</CardTitle>
          <CardDescription className="text-slate-400">
            Complete list of platform events
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {filteredEvents.length === 0 ? (
              <div className="text-slate-400">No events found.</div>
            ) : (
              filteredEvents.map((event) => {
                const eventId = event._id || event.id;

                return (
                  <div
                    key={eventId}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {event.title || "Untitled event"}
                          </h3>

                          <StatusBadge
                            status={(event.status as any) || "draft"}
                          />
                        </div>

                        <p className="text-sm text-slate-400 mb-3">
                          {event.description || "No description"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {event.startDate
                            ? new Date(event.startDate).toLocaleDateString()
                            : "No date"}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-slate-400">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {event.venue?.address || "Unknown location"}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-slate-400">
                        <User className="w-4 h-4" />
                        <span className="truncate">
                          {event.organizer
                            ? `${event.organizer.slice(0, 10)}...`
                            : event.organizerWallet
                              ? `${event.organizerWallet.slice(0, 10)}...`
                              : "Unknown organizer"}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-slate-400">
                        <DollarSign className="w-4 h-4" />
                        <span>
                          {typeof event.totalTickets === "number"
                            ? `${event.totalTickets} tickets`
                            : `From ${event.ticketTiers?.[0]?.price ?? 0} ETH`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        Created:{" "}
                        {event.createdAt
                          ? new Date(event.createdAt).toLocaleDateString()
                          : "Unknown"}
                      </div>

                      <div className="flex space-x-2">
                        {eventId && (
                          <>
                            <Link to={`/admin/events/${eventId}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-600 hover:bg-slate-700 text-white"
                              >
                                View Details
                              </Button>
                            </Link>

                            <Link to={`/admin/events/edit/${eventId}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-600 hover:bg-slate-700 text-white"
                              >
                                Edit
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
