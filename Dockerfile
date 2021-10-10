FROM alpine/bundle:2.7.2

RUN bundle init && \
    bundle add jekyll --version "3.9.0" 

#
# This `bundle install` is install in the image, so that it does not need to be installed in every run.
#

# Make sure you update the Gemfile from the latest version of versions.json
#   - https://pages.github.com/versions.json
#
# $ < versions.json ruby -e "require 'rubygems'; require 'json'; puts JSON.pretty_generate(JSON[STDIN.read]);" | grep : | sed 's/://' | sed 's/,//' | awk '{print("gem "$1", "$2)}' >> docs/Gemfile

COPY ./Gemfile  ./

RUN bundle install

CMD bundle exec jekyll serve --livereload
