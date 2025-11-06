import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Flag, Plus, X, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface AdvancedFeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage?: number;
  startDate?: Date;
  endDate?: Date;
  description?: string;
}

interface FeatureFlagManagerProps {
  flags: Record<string, boolean>;
  onChange: (flags: Record<string, boolean>) => void;
}

export function FeatureFlagManager({ flags, onChange }: FeatureFlagManagerProps) {
  const [advancedFlags, setAdvancedFlags] = useState<Map<string, AdvancedFeatureFlag>>(
    new Map(
      Object.entries(flags).map(([key, enabled]) => [
        key,
        { key, enabled, rolloutPercentage: 100 }
      ])
    )
  );
  const [newFlagKey, setNewFlagKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState<string | null>(null);

  const handleToggle = (key: string, enabled: boolean) => {
    const updated = new Map(advancedFlags);
    const flag = updated.get(key) || { key, enabled, rolloutPercentage: 100 };
    flag.enabled = enabled;
    updated.set(key, flag);
    setAdvancedFlags(updated);
    
    // Update parent
    const simpleFlags: Record<string, boolean> = {};
    updated.forEach((flag, key) => {
      simpleFlags[key] = flag.enabled;
    });
    onChange(simpleFlags);
  };

  const handleRolloutChange = (key: string, percentage: number) => {
    const updated = new Map(advancedFlags);
    const flag = updated.get(key);
    if (flag) {
      flag.rolloutPercentage = percentage;
      updated.set(key, flag);
      setAdvancedFlags(updated);
    }
  };

  const handleDateChange = (key: string, type: 'start' | 'end', date?: Date) => {
    const updated = new Map(advancedFlags);
    const flag = updated.get(key);
    if (flag) {
      if (type === 'start') {
        flag.startDate = date;
      } else {
        flag.endDate = date;
      }
      updated.set(key, flag);
      setAdvancedFlags(updated);
    }
  };

  const handleAddFlag = () => {
    if (newFlagKey && !advancedFlags.has(newFlagKey)) {
      const updated = new Map(advancedFlags);
      updated.set(newFlagKey, {
        key: newFlagKey,
        enabled: false,
        rolloutPercentage: 100
      });
      setAdvancedFlags(updated);
      setNewFlagKey('');

      // Update parent
      const simpleFlags: Record<string, boolean> = {};
      updated.forEach((flag, key) => {
        simpleFlags[key] = flag.enabled;
      });
      onChange(simpleFlags);
    }
  };

  const handleRemoveFlag = (key: string) => {
    const updated = new Map(advancedFlags);
    updated.delete(key);
    setAdvancedFlags(updated);

    // Update parent
    const simpleFlags: Record<string, boolean> = {};
    updated.forEach((flag, key) => {
      simpleFlags[key] = flag.enabled;
    });
    onChange(simpleFlags);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Advanced Feature Flags</h3>
        <Badge variant="outline">{advancedFlags.size} flags</Badge>
      </div>

      {/* Add new flag */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Add New Feature Flag</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Flag key (e.g., enable_analytics)"
              value={newFlagKey}
              onChange={(e) => setNewFlagKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFlag()}
            />
            <Button onClick={handleAddFlag} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Flags list */}
      <div className="space-y-3">
        {Array.from(advancedFlags.entries()).map(([key, flag]) => (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={(checked) => handleToggle(key, checked)}
                  />
                  <div>
                    <Label className="font-mono text-sm">{key}</Label>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={flag.enabled ? 'default' : 'secondary'}>
                    {flag.enabled ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(showAdvanced === key ? null : key)}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFlag(key)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {showAdvanced === key && (
              <CardContent className="space-y-4 border-t pt-4">
                {/* Rollout percentage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Rollout Percentage</Label>
                    <span className="text-sm font-medium">{flag.rolloutPercentage}%</span>
                  </div>
                  <Slider
                    value={[flag.rolloutPercentage || 100]}
                    onValueChange={([value]) => handleRolloutChange(key, value)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Gradually roll out this feature to a percentage of users
                  </p>
                </div>

                {/* Date scheduling */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {flag.startDate ? format(flag.startDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={flag.startDate}
                          onSelect={(date) => handleDateChange(key, 'start', date)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {flag.endDate ? format(flag.endDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={flag.endDate}
                          onSelect={(date) => handleDateChange(key, 'end', date)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
