'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

type Stat = {
  key: string;
  label: string;
  value: string | number;
  icon?: string;
};

type Section = 'homepage' | 'about' | 'casestudy' | 'benefits';

const SECTION_REFLECTS: Record<Section, string> = {
  homepage: '/ (Homepage) — stats band, /product — trust band, /talent-test — hero stats',
  about: '/about — stats grid (Founded, Students, States, Schools)',
  casestudy: '/case-study — header stats band',
  benefits: '/benefits — ROI stats band at top',
};

const sections = [
  { value: 'homepage', label: 'Homepage Stats' },
  { value: 'about', label: 'About Page Stats' },
  { value: 'casestudy', label: 'Case Study Header' },
  { value: 'benefits', label: 'Benefits ROI Stats' },
];

export default function StatsManagementPage() {
  const [selectedSection, setSelectedSection] = useState<Section>('homepage');
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast} = useToast();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?section=${selectedSection}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        setStats(data.data.stats || []);
      } else {
        // Initialize with default stats if none exist
        setStats(getDefaultStats(selectedSection));
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch stats',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedSection, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const getDefaultStats = (section: Section): Stat[] => {
    const defaults: Record<Section, Stat[]> = {
      homepage: [
        { key: 'tested', label: 'Students Tested', value: '50,000+', icon: '👨‍🎓' },
        { key: 'schools', label: 'Schools', value: '500+', icon: '🏫' },
        { key: 'gradeUplift', label: 'Avg. Grade Uplift', value: '35%', icon: '📈' },
        { key: 'renewalRate', label: 'Renewal Rate', value: '98%', icon: '🔄' },
      ],
      about: [
        { key: 'founded', label: 'Founded', value: '2020', icon: '📅' },
        { key: 'schools', label: 'Schools', value: '500+', icon: '🏫' },
        { key: 'students', label: 'Students', value: '50K+', icon: '👨‍🎓' },
        { key: 'states', label: 'States', value: '15', icon: '📍' },
      ],
      casestudy: [
        { key: 'schools', label: 'Schools Served', value: '500+', icon: '🏫' },
        { key: 'improvement', label: 'Avg. Improvement', value: '85%', icon: '📈' },
        { key: 'students', label: 'Students Impacted', value: '2M+', icon: '👨‍🎓' },
        { key: 'satisfaction', label: 'Satisfaction Rate', value: '95%', icon: '⭐' },
      ],
      benefits: [
        { key: 'timeSaved', label: 'Time Saved', value: '40%', icon: '⏱️' },
        { key: 'betterResults', label: 'Better Results', value: '25%', icon: '📈' },
        { key: 'parentSatisfaction', label: 'Parent Satisfaction', value: '60%', icon: '😊' },
        { key: 'efficiency', label: 'Efficiency Gain', value: '80%', icon: '📋' },
      ],
    };
    return defaults[section];
  };

  const handleStatChange = (index: number, field: keyof Stat, value: string) => {
    const newStats = [...stats];
    newStats[index] = { ...newStats[index], [field]: value };
    setStats(newStats);
  };

  const addNewStat = () => {
    setStats([...stats, { key: '', label: '', value: '', icon: '' }]);
  };

  const removeStat = (index: number) => {
    setStats(stats.filter((_, i) => i !== index));
  };

  const saveStats = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: selectedSection,
          stats,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Stats updated successfully',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to save stats',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="company-admin-page">
      <div className="company-admin-header-block">
        <h2 className="company-admin-title">Site Stats Management</h2>
        <p className="company-admin-description">
          Update statistics displayed across different pages
        </p>
      </div>

      {/* Section Selector */}
      <div className="mb-4">
        <label className="company-admin-field-label">
          Select Section
        </label>
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value as Section)}
          className="max-w-md"
        >
          {sections.map((section) => (
            <option key={section.value} value={section.value}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

            {/* Stats Form */}
      {loading ? (
        <div className="company-admin-loading">Loading...</div>
      ) : (
        <div className="space-y-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="company-admin-section grid gap-4 md:grid-cols-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Key (unique identifier)
                </label>
                <input
                  type="text"
                  value={stat.key}
                  onChange={(e) => handleStatChange(index, 'key', e.target.value)}
                  placeholder="e.g., students_tested"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Label (displayed text)
                </label>
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => handleStatChange(index, 'label', e.target.value)}
                  placeholder="e.g., Students Tested"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Value
                </label>
                <input
                  type="text"
                  value={stat.value}
                  onChange={(e) => handleStatChange(index, 'value', e.target.value)}
                  placeholder="e.g., 50,000+ or 99.5%"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={stat.icon || ''}
                    onChange={(e) => handleStatChange(index, 'icon', e.target.value)}
                    placeholder="📊"
                  />
                </div>
                <button
                  onClick={() => removeStat(index)}
                  className="company-admin-inline-icon-remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addNewStat}
            className="company-admin-inline-add"
          >
            Add New Stat
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={saveStats}
          disabled={saving}
          className="app-button-primary"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={fetchStats}
          className="app-button-secondary"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
