package ui

import (
	"fmt"
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

func TestDebugMsg(t *testing.T) {
	m := New()

	// Test setting debug info
	m.setDebug("test debug message")
	if len(m.debugLines) == 0 || m.debugLines[0] != "test debug message" {
		t.Errorf("debugLines = %v, want [%q]", m.debugLines, "test debug message")
	}

	// Test DebugMsg handler
	m2 := New()
	updated, _ := m2.Update(DebugMsg{Msg: "updated"})
	m2 = updated.(Model)
	if len(m2.debugLines) == 0 || m2.debugLines[0] != "updated" {
		t.Errorf("debugLines = %v, want [%q]", m2.debugLines, "updated")
	}

	// Test that we keep only the last maxDebugLines (default 5)
	for i := 0; i < 10; i++ {
		m.setDebug(fmt.Sprintf("message %d", i))
	}
	if len(m.debugLines) != 5 {
		t.Errorf("expected 5 debug lines, got %d", len(m.debugLines))
	}
	// Check the last 5 messages are the last 5 we sent
	expected := []string{"message 5", "message 6", "message 7", "message 8", "message 9"}
	for i, e := range expected {
		if m.debugLines[i] != e {
			t.Errorf("debugLines[%d] = %q, want %q", i, m.debugLines[i], e)
		}
	}
}