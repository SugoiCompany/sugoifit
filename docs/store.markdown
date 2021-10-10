---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

title: Store
layout: default
permalink: /store/
collection: products 
entries_layout: grid
---

{% for product in site.products %}
  {% include product.html %}
{% endfor %}
