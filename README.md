# SugoiFit

## General Infos
- The page is originally create by following the [blogpost](https://snipcart.com/blog/jekyll-ecommerce-tutorial).

## Develop Environment
- The repository provides a docker-compose configuration to both build/edit and run the page locally
  - To enter the environment to build/edit the page using Jekyll
    ```
    $ docker-compose run builder
    
    (container)$ bundle update           [Optional]
    ```
  - To run the server container locally
    ```
    $ docker-compose run server
    ```
  - Packages in [Github Pages dependencies](https://pages.github.com/versions/) are installed in the Dockerfile using $ROOT/Gemfile. The file must be modified to match with the latest setup.
    
## References
- based on [snipcart-jekyll](https://github.com/snipcart/snipcart-jekyll)
