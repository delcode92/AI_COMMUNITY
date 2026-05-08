package main

import(
	"fmt"
	"strings"

  "aicommunity.omniq.my.id/metasploit/readcsv"
)

func main() {
	fmt.Println("get result from csv ...");

	res:=readcsv.ReadCSV("./unleashed_sources.csv");
  
	for _, line := range res {
		// split the url & dom path
		s:=strings.Split(line, "#");

		fmt.Println("url: ", s[0]);
		fmt.Println("dom path: ", s[1]);
	}

}
