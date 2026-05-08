
/*

gpt-oss-120b curl command:

curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
  "model": "openai/gpt-oss-120b:free",
  "messages": [
    {
      "role": "user",
      "content": "How many r`s are in the word `strawberry?`"
    }
  ],
  "reasoning": {
    "enabled": true
  }
}'
*/

package main

import (
    "bufio"
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
    "os"
    "strconv"
    "strings"

    "github.com/gocolly/colly/v2"
)

type OpenRouterRequest struct {
    Model    string `json:"model"`
    Messages []struct {
        Role    string `json:"role"`
        Content string `json:"content"`
    } `json:"messages"`
    Reasoning struct {
        Enabled bool `json:"enabled"`
    } `json:"reasoning"`
}

type OpenRouterResponse struct {
    Choices []struct {
        Message struct {
            Content string `json:"content"`
        } `json:"message"`
    } `json:"choices"`
}

func summarizeWithGPT(text string) (string, error) {
    apiKey := os.Getenv("OPENROUTER_API_KEY")
    if apiKey == "" {
        return "", fmt.Errorf("OPENROUTER_API_KEY not set")
    }

    reqBody := OpenRouterRequest{
        Model: "openai/gpt-oss-120b:free",
        Messages: []struct {
            Role    string `json:"role"`
            Content string `json:"content"`
        }{{
            Role:    "user",
            Content: "Summarize the following content in three paragraph also add couple of keywords that makes the explanation more solid:\n" + text,
        }},
    }
    reqBody.Reasoning.Enabled = true

    bodyBytes, _ := json.Marshal(reqBody)
    req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(bodyBytes))
    if err != nil {
        return "", err
    }
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+apiKey)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    respBytes, _ := ioutil.ReadAll(resp.Body)
    var respData OpenRouterResponse
    if err := json.Unmarshal(respBytes, &respData); err != nil {
        return "", err
    }
    if len(respData.Choices) == 0 {
        return "", fmt.Errorf("no choices returned")
    }
    return strings.TrimSpace(respData.Choices[0].Message.Content), nil
}

func main() {
    c := colly.NewCollector()
    var links []string

    // Find and extract links only from <a> tags with class "cmp-side-navigation__item--link"
    c.OnHTML("a.astro-b3uc4r3d", func(e *colly.HTMLElement) {
        link := e.Attr("href")
        if link != "" {
            links = append(links, link)
            fmt.Printf("[%d] %s\n", len(links)-1, link)
        }
    })

    c.OnRequest(func(r *colly.Request) {
        fmt.Println("Visiting", r.URL)
    })

    c.Visit("https://www.offsec.com/metasploit-unleashed")

    if len(links) == 0 {
        fmt.Println("No links found.")
        return
    }

    // Prompt user to select link numbers (comma‑separated)
    fmt.Println("Enter link numbers to fetch (e.g., 0,2,3):")
    reader := bufio.NewReader(os.Stdin)
    input, _ := reader.ReadString('\n')
    input = strings.TrimSpace(input)
    parts := strings.Split(input, ",")
    var selected []string
    for _, p := range parts {
        idx, err := strconv.Atoi(strings.TrimSpace(p))
        if err != nil || idx < 0 || idx >= len(links) {
            fmt.Printf("Skipping invalid index: %s\n", p)
            continue
        }
        selected = append(selected, links[idx])
    }

    var summaries []string
    for _, url := range selected {
        fmt.Printf("Fetching %s...\n", url)
		resp, err := http.Get("https://www.offsec.com"+url)
        if err != nil {
            fmt.Printf("Failed to fetch %s: %v\n", url, err)
            continue
        }
        body, _ := ioutil.ReadAll(resp.Body)
        resp.Body.Close()
        summary, err := summarizeWithGPT(string(body))
        if err != nil {
            fmt.Printf("GPT summarization failed for %s: %v\n", url, err)
            continue
        }
        summaries = append(summaries, summary)
    }

    fmt.Println("--- Summaries ---")
    for i, s := range summaries {
        fmt.Printf("%d. %s\n", i+1, s)
    }
}


