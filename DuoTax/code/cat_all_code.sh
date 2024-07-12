find . -name '*.js' -exec sh -c 'echo "\n==> $1 <=="; cat "$1"' _ {} \; > all_my_code.txt  
