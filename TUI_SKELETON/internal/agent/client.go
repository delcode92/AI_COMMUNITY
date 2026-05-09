package agent

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

const openRouterURL = "https://openrouter.ai/api/v1/chat/completions"

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client struct {
	apiKey string
	model  string
	http   *http.Client
}

func NewClient() *Client {
	return &Client{
		apiKey: os.Getenv("OPENROUTER_API_KEY"),
		model:  func() string {
		if m := os.Getenv("MODEL_NAME"); m != "" {
			return m
		}
		return "anthropic/claude-3.5-sonnet"
	}(), // model from env or default
		http:   &http.Client{},
	}
}

// StreamChunk is a token chunk received from the stream.
type StreamChunk struct {
	Content string
	Err     error
	Done    bool
}

// Send sends messages and streams back tokens via the returned channel.
func (c *Client) Send(ctx context.Context, messages []Message) <-chan StreamChunk {
	ch := make(chan StreamChunk)

	go func() {
		defer close(ch)

		body, _ := json.Marshal(map[string]any{
			"model":    c.model,
			"messages": messages,
			"stream":   true,
		})

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterURL, bytes.NewReader(body))
		if err != nil {
			ch <- StreamChunk{Err: err}
			return
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("HTTP-Referer", "https://github.com/yourname/tui-agent")

		resp, err := c.http.Do(req)
		if err != nil {
			ch <- StreamChunk{Err: err}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			ch <- StreamChunk{Err: fmt.Errorf("API error: %s", resp.Status)}
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				ch <- StreamChunk{Done: true}
				return
			}

			var event struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if err := json.Unmarshal([]byte(data), &event); err != nil {
				continue
			}
			if len(event.Choices) > 0 {
				token := event.Choices[0].Delta.Content
				if token != "" {
					ch <- StreamChunk{Content: token}
				}
			}
		}

		if err := scanner.Err(); err != nil {
			ch <- StreamChunk{Err: err}
		}
	}()

	return ch
}
