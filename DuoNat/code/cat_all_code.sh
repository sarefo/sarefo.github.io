echo -e '\n==> index.html <==\n' > all_my_code.txt
cat ../index.html >> all_my_code.txt

# Find all .css files in the ../css/ directory and append to all_my_code.txt
find ../css -name '*.css' -exec sh -c 'echo "\n\n==> $1 <=="; cat "$1"' _ {} \; >> all_my_code.txt

# Find all .js files in the current directory and append to all_my_code.txt
find . -name '*.js' -exec sh -c 'echo "\n\n==> $1 <=="; cat "$1"' _ {} \; >> all_my_code.txt

