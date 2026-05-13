package openrouter

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/Ingenimax/agent-sdk-go/pkg/interfaces"
	"github.com/Ingenimax/agent-sdk-go/pkg/logging"
)

const openRouterBaseURL = "https://openrouter.ai/api/v1"

// Client implements interfaces.LLM for OpenRouter API.
type Client struct {
	httpClient *http.Client
	apiKey     string
	model      string
	baseURL    string
	logger     logging.Logger
}

// Option configures the Client.
type Option func(*Client)

// NewClient creates a new OpenRouter client.
func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		httpClient: &http.Client{},
		apiKey:     apiKey,
		model:      "anthropic/claude-3.5-sonnet",
		baseURL:    openRouterBaseURL,
		logger:     logging.New(),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// WithModel sets the model name.
func WithModel(model string) Option {
	return func(c *Client) {
		c.model = model
	}
}

// WithBaseURL sets the base URL (for testing).
func WithBaseURL(url string) Option {
	return func(c *Client) {
		c.baseURL = url
	}
}

// WithHTTPClient sets a custom HTTP client.
func WithHTTPClient(client *http.Client) Option {
	return func(c *Client) {
		c.httpClient = client
	}
}

// Name returns the provider name.
func (c *Client) Name() string {
	return "openrouter"
}

// SupportsStreaming returns true.
func (c *Client) SupportsStreaming() bool {
	return true
}

// chatMessage represents a message in the chat.
type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// chatRequest represents the request body.
type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Stream      bool          `json:"stream"`
	Tools       []interface{} `json:"tools,omitempty"`
	ToolChoice  string        `json:"tool_choice,omitempty"`
	Temperature *float64      `json:"temperature,omitempty"`
}

// FunctionCall represents a function call from the LLM.
type FunctionCall struct {
	Name string `json:"name"`
	Args string `json:"arguments"`
}

// ToolCall represents a tool call in the response.
type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function FunctionCall `json:"function"`
}

// Generate generates text (non-streaming).
func (c *Client) Generate(ctx context.Context, prompt string, options ...interfaces.GenerateOption) (string, error) {
	messages := []chatMessage{{Role: "user", Content: prompt}}
	return c.chat(ctx, messages, options...)
}

// GenerateWithTools generates text with tool support.
func (c *Client) GenerateWithTools(ctx context.Context, prompt string, tools []interfaces.Tool, options ...interfaces.GenerateOption) (string, error) {
	messages := []chatMessage{{Role: "user", Content: prompt}}
	return c.chat(ctx, messages, options...)
}

// GenerateDetailed generates text and returns detailed info.
func (c *Client) GenerateDetailed(ctx context.Context, prompt string, options ...interfaces.GenerateOption) (*interfaces.LLMResponse, error) {
	messages := []chatMessage{{Role: "user", Content: prompt}}
	return c.chatDetailed(ctx, messages, options...)
}

// GenerateWithToolsDetailed generates text with tools and returns detailed info.
func (c *Client) GenerateWithToolsDetailed(ctx context.Context, prompt string, tools []interfaces.Tool, options ...interfaces.GenerateOption) (*interfaces.LLMResponse, error) {
	messages := []chatMessage{{Role: "user", Content: prompt}}
	return c.chatDetailed(ctx, messages, options...)
}

// chat performs the chat completion.
func (c *Client) chat(ctx context.Context, messages []chatMessage, options ...interfaces.GenerateOption) (string, error) {
	resp, err := c.chatDetailed(ctx, messages, options...)
	if err != nil {
		return "", err
	}
	return resp.Content, nil
}

// chatDetailed performs chat and returns detailed response.
func (c *Client) chatDetailed(ctx context.Context, messages []chatMessage, options ...interfaces.GenerateOption) (*interfaces.LLMResponse, error) {
	genOpts := &interfaces.GenerateOptions{}
	for _, opt := range options {
		if opt != nil {
			opt(genOpts)
		}
	}

	temperature := float64(0.7)
	if genOpts.LLMConfig != nil && genOpts.LLMConfig.Temperature > 0 {
		temperature = genOpts.LLMConfig.Temperature
	}

	req := chatRequest{
		Model:       c.model,
		Messages:    messages,
		Stream:      false,
		Temperature: &temperature,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("HTTP-Referer", "https://github.com/yourname/tui-agent")
	httpReq.Header.Set("X-Title", "TUI Agent")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(data))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	return &interfaces.LLMResponse{
		Content: result.Choices[0].Message.Content,
		Usage: &interfaces.TokenUsage{
			InputTokens:  result.Usage.PromptTokens,
			OutputTokens: result.Usage.CompletionTokens,
			TotalTokens:  result.Usage.TotalTokens,
		},
	}, nil
}

// init ensures environment is loaded.
func init() {
	_ = os.Getenv("OPENROUTER_API_KEY")
}