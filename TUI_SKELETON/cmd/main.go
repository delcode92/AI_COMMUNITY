package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	// "time"

	"github.com/joho/godotenv"
	tea "github.com/charmbracelet/bubbletea"
	"aicommunity.omniq.my.id/cliagent/internal/ui"
)

func main() {
	// Load environment variables from .env if present
	_ = godotenv.Load()
	if os.Getenv("OPENROUTER_API_KEY") == "" {
		fmt.Fprintln(os.Stderr, "error: OPENROUTER_API_KEY is not set")
		os.Exit(1)
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	p := tea.NewProgram(
		ui.New(),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	// Debug: set initial debug info after a short delay to ensure TUI is ready
	// go func() {
	// 	// time.Sleep(200 * time.Millisecond)
	// 	p.Send(ui.DebugMsg{Msg: "\n\napplication started 123\n"})
	// 	p.Send(ui.DebugMsg{Msg: "coba 123\n"})
	// }()

	// Run with signal handling
	go func() {
		<-sigChan
		p.Quit()
	}()

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
