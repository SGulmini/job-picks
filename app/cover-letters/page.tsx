"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type CoverLetterTemplate = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const TEMPLATES_STORAGE_KEY = "jobPicks_coverLetterTemplates_v1";

export default function CoverLettersPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<CoverLetterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CoverLetterTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setEmail(session.user?.email || null);
    };
    checkAuth();
  }, [router]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      // Try to load from Supabase first
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from("cover_letter_templates")
          .select("*")
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false });
        
        if (!error && data) {
          const formatted = data.map((t: any) => ({
            id: t.id,
            name: t.name,
            content: t.content,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          }));
          setTemplates(formatted);
          setIsLoading(false);
          return;
        }
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTemplates(Array.isArray(parsed) ? parsed : []);
      } else {
        setTemplates([]);
      }
    } catch (e) {
      console.error("Error loading templates:", e);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Save template to Supabase or localStorage
  const saveTemplate = useCallback(async (template: Omit<CoverLetterTemplate, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) => {
    try {
      const now = new Date().toISOString();
      const templateToSave: CoverLetterTemplate = {
        ...template,
        createdAt: template.createdAt || now,
        updatedAt: now,
      };

      // Try to save to Supabase first
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { error } = await supabase
          .from("cover_letter_templates")
          .upsert({
            id: template.id,
            user_id: session.user.id,
            name: template.name,
            content: template.content,
            updated_at: now,
            created_at: template.createdAt || now,
          }, {
            onConflict: "id",
          });
        
        if (!error) {
          await loadTemplates();
          return;
        }
      }

      // Fallback to localStorage
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      const index = existing.findIndex((t: CoverLetterTemplate) => t.id === template.id);
      
      if (index >= 0) {
        existing[index] = templateToSave;
      } else {
        existing.push(templateToSave);
      }
      
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(existing));
      await loadTemplates();
    } catch (e: any) {
      setError(e?.message || "Failed to save template");
      throw e;
    }
  }, [loadTemplates]);

  // Delete template
  const deleteTemplate = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    try {
      // Try to delete from Supabase first
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { error } = await supabase
          .from("cover_letter_templates")
          .delete()
          .eq("id", id)
          .eq("user_id", session.user.id);
        
        if (!error) {
          await loadTemplates();
          return;
        }
      }

      // Fallback to localStorage
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (stored) {
        const existing = JSON.parse(stored);
        const filtered = existing.filter((t: CoverLetterTemplate) => t.id !== id);
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
      }
      await loadTemplates();
    } catch (e: any) {
      setError(e?.message || "Failed to delete template");
    }
  }, [loadTemplates]);

  // Handle file import
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      setTemplateName(fileName);
      setTemplateContent(content);
      setEditingTemplate(null);
      setShowCreateModal(true);
    };
    reader.readAsText(file);
  }, []);

  // Handle create/edit
  const handleSave = useCallback(async () => {
    if (!templateName.trim()) {
      setError("Please enter a template name");
      return;
    }
    if (!templateContent.trim()) {
      setError("Please enter template content");
      return;
    }

    try {
      const id = editingTemplate?.id || `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await saveTemplate({
        id,
        name: templateName.trim(),
        content: templateContent.trim(),
        createdAt: editingTemplate?.createdAt,
      });
      setShowCreateModal(false);
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateContent("");
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to save template");
    }
  }, [templateName, templateContent, editingTemplate, saveTemplate]);

  // Start editing
  const startEdit = useCallback((template: CoverLetterTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateContent(template.content);
    setShowCreateModal(true);
    setError(null);
  }, []);

  // Start creating new
  const startCreate = useCallback(() => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateContent("");
    setShowCreateModal(true);
    setError(null);
  }, []);

  if (isLoading) {
    return (
      <main className="jp-page">
        <div>Loading...</div>
      </main>
    );
  }

  return (
    <main className="jp-page">
      <div className="jp-topbar">
        <div>
          <h1 style={{ margin: 0 }}>Cover Letter Templates</h1>
          <p style={{ margin: "6px 0 0 0" }}>Manage your custom cover letter templates</p>
        </div>
        <div className="jp-topbar-actions">
          <Link
            href="/home"
            style={{
              display: "inline-block",
              padding: "10px 12px",
              height: 42,
              lineHeight: "22px",
              borderRadius: 10,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Your Templates</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <label
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid var(--jp-panel-border)",
                backgroundColor: "var(--jp-panel-bg)",
                color: "var(--jp-panel-fg)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Import from file
              <input
                type="file"
                accept=".txt,.docx,.doc"
                onChange={handleFileImport}
                style={{ display: "none" }}
              />
            </label>
            <button
              onClick={startCreate}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid var(--jp-panel-border)",
                background: "linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              + Create New Template
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.35)",
              backgroundColor: "rgba(239,68,68,0.08)",
              color: "#ef4444",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {templates.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              borderRadius: 12,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
            }}
          >
            <p style={{ margin: 0, opacity: 0.7 }}>No templates yet. Create your first template to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {templates.map((template) => (
              <div
                key={template.id}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid var(--jp-panel-border)",
                  backgroundColor: "var(--jp-panel-bg)",
                  color: "var(--jp-panel-fg)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{template.name}</h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.7 }}>
                      Updated: {new Date(template.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => startEdit(template)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--jp-panel-border)",
                        backgroundColor: "transparent",
                        color: "var(--jp-panel-fg)",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(239,68,68,0.35)",
                        backgroundColor: "rgba(239,68,68,0.08)",
                        color: "#ef4444",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid var(--jp-input-border)",
                    backgroundColor: "var(--jp-input-bg)",
                    color: "var(--jp-input-fg)",
                    fontSize: 12,
                    maxHeight: 200,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                  }}
                >
                  {template.content.substring(0, 500)}
                  {template.content.length > 500 && "..."}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={() => setShowCreateModal(false)}
        >
          <div
            style={{
              width: "min(800px, 100%)",
              maxHeight: "90vh",
              borderRadius: 16,
              border: "1px solid var(--jp-panel-border)",
              backgroundColor: "var(--jp-panel-bg)",
              color: "var(--jp-panel-fg)",
              boxShadow: "var(--jp-shadow)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>
              {editingTemplate ? "Edit Template" : "Create New Template"}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Template Name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Standard Cover Letter, Technical Position Template..."
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--jp-input-border)",
                  backgroundColor: "var(--jp-input-bg)",
                  color: "var(--jp-input-fg)",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ marginBottom: 16, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Template Content
              </label>
              <textarea
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                placeholder="Paste your cover letter template here. You can use placeholders like {{NAME}}, {{COMPANY}}, {{POSITION}}, etc."
                style={{
                  width: "100%",
                  flex: 1,
                  minHeight: 300,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--jp-input-border)",
                  backgroundColor: "var(--jp-input-bg)",
                  color: "var(--jp-input-fg)",
                  fontSize: 13,
                  fontFamily: "monospace",
                  resize: "vertical",
                  whiteSpace: "pre-wrap",
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.35)",
                  backgroundColor: "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTemplate(null);
                  setTemplateName("");
                  setTemplateContent("");
                  setError(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--jp-panel-border)",
                  backgroundColor: "transparent",
                  color: "var(--jp-panel-fg)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--jp-panel-border)",
                  background: "linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {editingTemplate ? "Update Template" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
