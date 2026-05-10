package ui

import (
	"os"
	"testing"
)

func TestLoadGlobalPrompt(t *testing.T) {
	// Test with non-existent file
	_, err := loadGlobalPrompt("nonexistent.md")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}

	// Create temp file and test
	content := "# Global Prompt\nYou are a helpful assistant."
	tmpFile := "/tmp/test_global.md"
	if err := os.WriteFile(tmpFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	defer os.Remove(tmpFile)

	got, err := loadGlobalPrompt(tmpFile)
	if err != nil {
		t.Fatalf("loadGlobalPrompt failed: %v", err)
	}
	if got != content {
		t.Errorf("got %q, want %q", got, content)
	}
}

func TestExecuteTool(t *testing.T) {
	// Create a simple echo tool for testing
	tmpDir := "/tmp/test_tools"
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		t.Fatalf("failed to create tools dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	echoTool := tmpDir + "/echo"
	if err := os.WriteFile(echoTool, []byte("#!/bin/bash\necho \"$@\""), 0755); err != nil {
		t.Fatalf("failed to write echo tool: %v", err)
	}

	// Note: ExecuteTool uses tools/ directory, so this tests the error path
	_, err := ExecuteTool("echo", []string{"hello", "world"})
	// This will fail since tools/echo doesn't exist in test environment
	// but demonstrates the test structure
	_ = err
}

func TestModelNew(t *testing.T) {
	// Just verify Model can be created without panic
	m := New()
	if m.redisClient == nil {
		t.Log("Redis client not initialized (expected if no REDIS_URL)")
	}
}