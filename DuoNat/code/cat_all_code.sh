echo '\n==> index.html <==\n' > all_my_code.txt
cat ../index.html >> all_my_code.txt
find . -name '*.css' -exec sh -c 'echo "\n==> $1 <=="; cat "$1"' _ {} \; >> all_my_code.txt  
find . -name '*.js' -exec sh -c 'echo "\n==> $1 <=="; cat "$1"' _ {} \; >> all_my_code.txt  
