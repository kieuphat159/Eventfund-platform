import React, { useState } from 'react';
import { Calendar, MapPin, Upload, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';

export const CreateEvent: React.FC = () => {
  const [ticketTiers, setTicketTiers] = useState([
    { name: 'General', price: '', supply: '' },
  ]);

  const addTier = () => {
    setTicketTiers([...ticketTiers, { name: '', price: '', supply: '' }]);
  };

  const removeTier = (index: number) => {
    setTicketTiers(ticketTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: 'name' | 'price' | 'supply', value: string) => {
    const updated = [...ticketTiers];
    updated[index] = { ...updated[index], [field]: value };
    setTicketTiers(updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Create Event</h1>
        <p className="text-slate-400">Set up a new event with NFT tickets</p>
      </div>

      {/* Basic Info */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Details</CardTitle>
          <CardDescription className="text-slate-400">Basic information about your event</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-white">Event Title *</Label>
            <Input
              id="title"
              placeholder="Enter event name"
              className="mt-1.5 bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-white">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe your event..."
              className="mt-1.5 bg-slate-800 border-slate-700 text-white min-h-[120px]"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-white">Event Date *</Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="date"
                  type="date"
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="time" className="text-white">Event Time *</Label>
              <Input
                id="time"
                type="time"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location" className="text-white">Location *</Label>
            <div className="relative mt-1.5">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="location"
                placeholder="Enter venue or address"
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category" className="text-white">Category *</Label>
            <select
              id="category"
              className="mt-1.5 w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-white text-sm"
            >
              <option value="">Select a category</option>
              <option value="music">Music</option>
              <option value="tech">Technology</option>
              <option value="sports">Sports</option>
              <option value="art">Art & Culture</option>
              <option value="business">Business</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Event Image */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Image</CardTitle>
          <CardDescription className="text-slate-400">Upload a cover image for your event</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-12 text-center hover:border-purple-500/50 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-white mb-2">Click to upload or drag and drop</p>
            <p className="text-sm text-slate-500">PNG, JPG or WEBP (max. 5MB)</p>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Tiers */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Ticket Tiers</CardTitle>
              <CardDescription className="text-slate-400">Define different ticket types and pricing</CardDescription>
            </div>
            <Button
              onClick={addTier}
              variant="outline"
              size="sm"
              className="border-slate-700 hover:bg-slate-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticketTiers.map((tier, index) => (
            <div key={index} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-white font-medium">Tier {index + 1}</h4>
                {ticketTiers.length > 1 && (
                  <Button
                    onClick={() => removeTier(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`tier-name-${index}`} className="text-slate-300">Tier Name</Label>
                  <Input
                    id={`tier-name-${index}`}
                    placeholder="e.g., VIP, General"
                    value={tier.name}
                    onChange={(e) => updateTier(index, 'name', e.target.value)}
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor={`tier-price-${index}`} className="text-slate-300">Price (ETH)</Label>
                  <Input
                    id={`tier-price-${index}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={tier.price}
                    onChange={(e) => updateTier(index, 'price', e.target.value)}
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor={`tier-supply-${index}`} className="text-slate-300">Total Supply</Label>
                  <Input
                    id={`tier-supply-${index}`}
                    type="number"
                    placeholder="100"
                    value={tier.supply}
                    onChange={(e) => updateTier(index, 'supply', e.target.value)}
                    className="mt-1.5 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Investment Options */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Investment Options</CardTitle>
          <CardDescription className="text-slate-400">Allow others to invest in your event's success</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="enable-investment"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800"
            />
            <Label htmlFor="enable-investment" className="text-white">Enable event investment</Label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="investment-target" className="text-slate-300">Investment Target (ETH)</Label>
              <Input
                id="investment-target"
                type="number"
                step="0.1"
                placeholder="10.0"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="revenue-share" className="text-slate-300">Revenue Share (%)</Label>
              <Input
                id="revenue-share"
                type="number"
                placeholder="20"
                max="100"
                className="mt-1.5 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white">
          Save as Draft
        </Button>
        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8">
          Submit for Review
        </Button>
      </div>
    </div>
  );
};